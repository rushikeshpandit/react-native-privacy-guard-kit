package com.privacyguardkit

import android.content.Context
import android.database.ContentObserver
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore

/**
 * ScreenshotObserver — Detects screenshots via the MediaStore ContentObserver API.
 *
 * ── HOW IT WORKS ──────────────────────────────────────────────────────────────
 *   Registers a [ContentObserver] on [MediaStore.Images.Media.EXTERNAL_CONTENT_URI].
 *   When Android writes a new image to external storage (screenshots included),
 *   [ContentObserver.onChange] fires. The observer queries MediaStore for the new
 *   image's path/name and fires [onScreenshotTaken] when a screenshot is detected.
 *
 * ── EMULATOR SUPPORT ──────────────────────────────────────────────────────────
 *   On Android emulators, [ContentObserver.onChange] sometimes fires with the root
 *   URI (MediaStore.Images.Media.EXTERNAL_CONTENT_URI) rather than the specific item
 *   URI. In this case we cannot query by URI directly. Instead we query the latest
 *   image inserted into MediaStore sorted by DATE_ADDED DESC and check its path.
 *   This makes screenshot detection reliable on both emulators and real devices.
 *
 * ── API VERSION STRATEGY ──────────────────────────────────────────────────────
 *   API 29-32 (Android 10-12L):
 *     Scoped storage enforced. Uses RELATIVE_PATH (API 29+) as primary column.
 *     Falls back to DATA column if RELATIVE_PATH is absent.
 *
 *   API 33+ (Android 13, T):
 *     READ_MEDIA_IMAGES is the required permission instead of READ_EXTERNAL_STORAGE.
 *     RELATIVE_PATH is used. DATA column may return null on strict scoped storage.
 *
 * ── OEM PATH VARIANCE ─────────────────────────────────────────────────────────
 *   Covered by [SCREENSHOT_PATH_KEYWORDS]:
 *     Samsung:  "Pictures/Screenshots/"
 *     Xiaomi:   "DCIM/Screenshots/"
 *     Huawei:   "Pictures/Screenshots/"
 *     OnePlus:  "Pictures/Screenshots/"
 *     Emulator: "Pictures/Screenshots/"
 *
 * ── DEBOUNCE ──────────────────────────────────────────────────────────────────
 *   MediaStore fires onChange multiple times per screenshot. A [DEBOUNCE_MS]
 *   window suppresses duplicate callbacks for the same event.
 *
 * @param context           Application or ReactApplicationContext.
 * @param onScreenshotTaken Lambda invoked on the main thread when a screenshot is detected.
 */
class ScreenshotObserver(
    private val context: Context,
    private val onScreenshotTaken: () -> Unit
) {
    companion object {
        /**
         * Case-insensitive substrings matched against the image path to identify
         * screenshots. Covers standard Android plus major OEM directory names.
         */
        private val SCREENSHOT_PATH_KEYWORDS = listOf(
            "screenshot",
            "screen_shot",
            "screencap",
            "captured"
        )

        /**
         * Minimum elapsed time (ms) between two successive [onScreenshotTaken]
         * callbacks. Prevents duplicate events from multiple onChange notifications
         * for a single screenshot write.
         */
        private const val DEBOUNCE_MS = 1_000L

        /**
         * Maximum age (ms) of a MediaStore image to be considered a new screenshot.
         * If the most-recent image was inserted more than this many ms ago, we
         * assume it pre-dates our observation window and ignore it.
         * Relevant when the observer fires with a root URI on emulators.
         */
        private const val MAX_SCREENSHOT_AGE_MS = 3_000L
    }

    /** Active ContentObserver instance. Null when not registered. */
    private var contentObserver: ContentObserver? = null

    /**
     * Epoch-ms timestamp of the most recent accepted screenshot event.
     * Initialised to 0 so the first event is always accepted.
     */
    private var lastScreenshotTime = 0L

    /**
     * Registers the ContentObserver and begins watching for new screenshots.
     *
     * Runs onChange callbacks on the main (UI) thread via [Looper.getMainLooper].
     * Safe to call if already started (new observer replaces any existing one).
     *
     * ── PERMISSION REQUIREMENTS ───────────────────────────────────────────────
     *   API 29-32: android.permission.READ_EXTERNAL_STORAGE
     *   API 33+  : android.permission.READ_MEDIA_IMAGES
     */
    fun start() {
        // Stop any existing observer before re-registering (idempotent restart).
        stop()

        val handler = Handler(Looper.getMainLooper())

        contentObserver = object : ContentObserver(handler) {
            /**
             * Invoked by the OS when content changes beneath EXTERNAL_CONTENT_URI.
             *
             * [uri] may be:
             *   - A specific item URI (e.g. content://media/external/images/media/42)
             *     → query that specific row.
             *   - The root URI (MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
             *     → happens frequently on emulators and some OEM devices.
             *     → query the latest inserted image from the full table instead.
             *   - null → nothing to query, ignored.
             */
            override fun onChange(selfChange: Boolean, uri: Uri?) {
                super.onChange(selfChange, uri)
                uri ?: return

                val isRootUri = uri == MediaStore.Images.Media.EXTERNAL_CONTENT_URI

                val detected = if (isRootUri) {
                    // Emulator / root-URI path: query the most recently inserted image
                    isLatestImageAScreenshot()
                } else {
                    // Specific item URI: query that exact row (fast, preferred path)
                    isScreenshot(uri)
                }

                if (detected) {
                    val now = System.currentTimeMillis()
                    if (now - lastScreenshotTime > DEBOUNCE_MS) {
                        lastScreenshotTime = now
                        onScreenshotTaken()
                    }
                }
            }
        }

        context.contentResolver.registerContentObserver(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            /* notifyForDescendants = */ true,
            contentObserver!!
        )
    }

    /**
     * Unregisters the ContentObserver and releases all resources.
     *
     * MUST be called on teardown to avoid leaking a registered ContentObserver.
     * Idempotent — safe to call if [start] was never called or already stopped.
     */
    fun stop() {
        contentObserver?.let {
            context.contentResolver.unregisterContentObserver(it)
        }
        contentObserver = null
    }

    /**
     * Queries MediaStore for the most recently added image and checks whether it
     * is a screenshot taken within the last [MAX_SCREENSHOT_AGE_MS] milliseconds.
     *
     * Used as the fallback path when onChange fires with a root URI (common on
     * emulators). Queries with DATE_ADDED DESC and LIMIT 1.
     *
     * Columns queried:
     *   RELATIVE_PATH (API 29+) — preferred, scoped-storage-safe.
     *   DISPLAY_NAME            — fallback keyword check on the filename itself,
     *                             which often contains "screenshot" even when
     *                             RELATIVE_PATH does not match on some OEM builds.
     *   DATE_ADDED              — used to discard pre-existing images.
     *
     * @return true if the most recent image looks like a fresh screenshot.
     */
    private fun isLatestImageAScreenshot(): Boolean {
        return try {
            val projection = buildList {
                add(MediaStore.Images.Media.DATE_ADDED)
                add(MediaStore.Images.Media.DISPLAY_NAME)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    add(MediaStore.Images.Media.RELATIVE_PATH)
                } else {
                    @Suppress("DEPRECATION")
                    add(MediaStore.Images.Media.DATA)
                }
            }.toTypedArray()

            val cursor = context.contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection,
                /* selection     = */ null,
                /* selectionArgs = */ null,
                /* sortOrder     = */ "${MediaStore.Images.Media.DATE_ADDED} DESC LIMIT 1"
            ) ?: return false

            cursor.use {
                if (!it.moveToFirst()) return false

                // Age check — discard images older than MAX_SCREENSHOT_AGE_MS
                val dateAddedIdx = it.getColumnIndex(MediaStore.Images.Media.DATE_ADDED)
                if (dateAddedIdx != -1) {
                    val dateAddedSec = it.getLong(dateAddedIdx)
                    val ageMs = System.currentTimeMillis() - (dateAddedSec * 1000L)
                    if (ageMs > MAX_SCREENSHOT_AGE_MS) return false
                }

                // Path check via RELATIVE_PATH or DATA column
                val pathColumn = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    MediaStore.Images.Media.RELATIVE_PATH
                } else {
                    @Suppress("DEPRECATION")
                    MediaStore.Images.Media.DATA
                }
                val pathIdx = it.getColumnIndex(pathColumn)
                val path = if (pathIdx != -1) it.getString(pathIdx) else null

                if (path != null && containsScreenshotKeyword(path)) return true

                // DISPLAY_NAME fallback: filename-based detection
                // (e.g. "Screenshot_20240101_120000.png")
                val nameIdx = it.getColumnIndex(MediaStore.Images.Media.DISPLAY_NAME)
                val name = if (nameIdx != -1) it.getString(nameIdx) else null
                name != null && containsScreenshotKeyword(name)
            }
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Queries MediaStore for the path of the image at [uri] and checks whether
     * it looks like a screenshot based on [SCREENSHOT_PATH_KEYWORDS].
     *
     * ── COLUMN SELECTION BY API LEVEL ────────────────────────────────────────
     *   API 29+ (Q, scoped storage): queries RELATIVE_PATH.
     *   API < 29 (fallback): queries the legacy DATA column.
     *
     *   Additionally queries DISPLAY_NAME as a secondary keyword source,
     *   providing detection even when RELATIVE_PATH doesn't match OEM variants.
     *
     * @param uri The MediaStore item URI for the newly written image.
     * @return true if the image appears to be a screenshot; false otherwise.
     */
    private fun isScreenshot(uri: Uri): Boolean {
        return try {
            val pathColumn = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                MediaStore.Images.Media.RELATIVE_PATH
            } else {
                @Suppress("DEPRECATION")
                MediaStore.Images.Media.DATA
            }

            val projection = arrayOf(pathColumn, MediaStore.Images.Media.DISPLAY_NAME)

            val cursor = context.contentResolver.query(
                uri,
                projection,
                /* selection     = */ null,
                /* selectionArgs = */ null,
                /* sortOrder     = */ null
            ) ?: return false

            cursor.use {
                if (!it.moveToFirst()) return false

                // Primary check: path/directory keyword match
                val pathIdx = it.getColumnIndex(pathColumn)
                val path = if (pathIdx != -1) it.getString(pathIdx) else null
                if (path != null && containsScreenshotKeyword(path)) return true

                // Secondary check: filename keyword match
                val nameIdx = it.getColumnIndex(MediaStore.Images.Media.DISPLAY_NAME)
                val name = if (nameIdx != -1) it.getString(nameIdx) else null
                name != null && containsScreenshotKeyword(name)
            }
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Returns true if [text] (lowercased) contains any of the [SCREENSHOT_PATH_KEYWORDS].
     * Centralised to avoid duplicating the loop in multiple query methods.
     *
     * @param text The path, relative path, or filename to inspect.
     */
    private fun containsScreenshotKeyword(text: String): Boolean {
        val lower = text.lowercase()
        return SCREENSHOT_PATH_KEYWORDS.any { keyword -> lower.contains(keyword) }
    }
}
