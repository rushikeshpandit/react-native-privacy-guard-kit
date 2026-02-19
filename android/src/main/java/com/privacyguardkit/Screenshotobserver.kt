package com.privacyguardkit

import android.content.Context
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore

/**
 * Watches the MediaStore for new image entries in the Screenshots folder.
 * Fires [onScreenshotTaken] when a new screenshot is detected.
 */
class ScreenshotObserver(
    private val context: Context,
    private val onScreenshotTaken: () -> Unit
) {
    private var contentObserver: ContentObserver? = null

    fun start() {
        val handler = Handler(Looper.getMainLooper())

        contentObserver = object : ContentObserver(handler) {
            override fun onChange(selfChange: Boolean, uri: Uri?) {
                super.onChange(selfChange, uri)
                uri ?: return
                if (isScreenshot(uri)) {
                    onScreenshotTaken()
                }
            }
        }

        context.contentResolver.registerContentObserver(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            true,
            contentObserver!!
        )
    }

    fun stop() {
        contentObserver?.let {
            context.contentResolver.unregisterContentObserver(it)
        }
        contentObserver = null
    }

    private fun isScreenshot(uri: Uri): Boolean {
        return try {
            val cursor = context.contentResolver.query(
                uri,
                arrayOf(MediaStore.Images.Media.DATA),
                null, null, null
            )
            cursor?.use {
                if (it.moveToFirst()) {
                    val path = it.getString(
                        it.getColumnIndexOrThrow(MediaStore.Images.Media.DATA)
                    )
                    path?.lowercase()?.contains("screenshot") == true
                } else false
            } ?: false
        } catch (e: Exception) {
            false
        }
    }
}