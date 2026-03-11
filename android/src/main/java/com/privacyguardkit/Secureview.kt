package com.privacyguardkit

import android.content.Context
import android.view.ActionMode
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import com.facebook.react.views.view.ReactViewGroup

/**
 * SecureView — A Fabric-compatible ReactViewGroup that prevents copy/paste
 * and text selection on all TextView and EditText children, recursively.
 *
 * ── WHY ReactViewGroup (not plain ViewGroup) ──────────────────────────────────
 *   Fabric's SurfaceMountingManager requires view managers to implement
 *   IViewGroupManager. Extending ReactViewGroup ensures the correct cast at runtime
 *   on both Old Architecture (Paper) and New Architecture (Fabric).
 *
 * ── API VERSION NOTES ─────────────────────────────────────────────────────────
 *   All APIs used (ActionMode.Callback, setTextIsSelectable, isLongClickable,
 *   customSelectionActionModeCallback, customInsertionActionModeCallback) are
 *   available on API 29+ with no version-specific branching required.
 *
 * ── EMULATOR NOTES ────────────────────────────────────────────────────────────
 *   Long-press text selection and the copy/paste floating toolbar are fully
 *   functional on Android emulators. Blocking them via [BlockActionMode] works
 *   identically on emulators and real devices.
 *
 * ── THREAD SAFETY ─────────────────────────────────────────────────────────────
 *   All view mutations must happen on the UI thread. This class is called
 *   exclusively from React Native's UI thread — no additional synchronisation needed.
 *
 * USAGE (from React Native JSX):
 *   <RNSecureView isCopyPasteDisabled={true}>
 *     <Text>Protected content</Text>
 *   </RNSecureView>
 */
class SecureView(context: Context) : ReactViewGroup(context) {

    /**
     * Tracks whether copy/paste protection is currently enabled.
     * Persists across child additions so newly mounted children automatically
     * inherit the current protection state via [onViewAdded].
     */
    private var copyPasteDisabled = false

    /**
     * Enables copy/paste protection for all current and future children.
     *
     * Walks the current child subtree recursively and sets [copyPasteDisabled] = true
     * so that future children added via [onViewAdded] are also protected immediately.
     *
     * Idempotent — safe to call multiple times.
     */
    fun setIsCopyPasteDisabled() {
        copyPasteDisabled = true
        applyToChildren(this)
    }

    /**
     * Removes copy/paste protection from all current children and stops
     * protecting future children.
     *
     * Idempotent — safe to call multiple times.
     */
    fun enableCopyPaste() {
        copyPasteDisabled = false
        restoreChildren(this)
    }

    /**
     * Intercepts Fabric's child-mount callback to apply protection eagerly.
     *
     * Called each time a child View is attached to this ViewGroup. Applying
     * protection here — before the child is fully laid out — prevents any
     * visible flash of selectable text.
     *
     * @param child The View being attached to this SecureView.
     */
    override fun onViewAdded(child: View) {
        super.onViewAdded(child)
        if (copyPasteDisabled) {
            applyToView(child)
            if (child is ViewGroup) applyToChildren(child)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Private recursive helpers
    // ─────────────────────────────────────────────────────────────

    /**
     * Recursively applies copy/paste protection to every TextView and
     * EditText found within [group]'s subtree.
     *
     * Uses an index-based for loop to avoid ConcurrentModificationException
     * during Fabric animated layout transitions. Null child slots are skipped
     * defensively — Fabric can return null in rare concurrent-mount edge cases.
     *
     * @param group The ViewGroup root of the subtree to protect.
     */
    private fun applyToChildren(group: ViewGroup) {
        for (i in 0 until group.childCount) {
            val child = group.getChildAt(i) ?: continue
            applyToView(child)
            if (child is ViewGroup) applyToChildren(child)
        }
    }

    /**
     * Recursively removes copy/paste protection from every TextView and
     * EditText found within [group]'s subtree.
     *
     * @param group The ViewGroup root of the subtree to restore.
     */
    private fun restoreChildren(group: ViewGroup) {
        for (i in 0 until group.childCount) {
            val child = group.getChildAt(i) ?: continue
            restoreView(child)
            if (child is ViewGroup) restoreChildren(child)
        }
    }

    /**
     * Applies copy/paste blocking to a single [view].
     *
     * ── EditText vs TextView ordering ────────────────────────────────────────
     *   EditText is checked first because EditText IS-A TextView. Without this
     *   ordering, the TextView branch matches EditText and misses setting
     *   [EditText.customInsertionActionModeCallback].
     *
     * ── customInsertionActionModeCallback ────────────────────────────────────
     *   Available since API 26 (Oreo). Since our minimum is API 29, no version
     *   check is needed.
     *
     * @param view The target view. Non-TextView/EditText views are ignored.
     */
    private fun applyToView(view: View) {
        when (view) {
            is EditText -> {
                view.isLongClickable = false
                view.setTextIsSelectable(false)
                view.customSelectionActionModeCallback = BlockActionMode
                view.customInsertionActionModeCallback = BlockActionMode
            }
            is TextView -> {
                view.isLongClickable = false
                view.setTextIsSelectable(false)
                view.customSelectionActionModeCallback = BlockActionMode
            }
            // All other view types: no copy/paste surface — no action needed.
        }
    }

    /**
     * Restores default text-interaction behaviour for a single [view].
     *
     * Nullifying the action-mode callbacks returns control to Android's
     * built-in copy/paste handling. Re-enabling [isLongClickable] and
     * [setTextIsSelectable] restores the selection handles.
     *
     * @param view The target view. Non-TextView/EditText views are ignored.
     */
    private fun restoreView(view: View) {
        when (view) {
            is EditText -> {
                view.isLongClickable = true
                view.setTextIsSelectable(true)
                view.customSelectionActionModeCallback = null
                view.customInsertionActionModeCallback = null
            }
            is TextView -> {
                view.isLongClickable = true
                view.setTextIsSelectable(true)
                view.customSelectionActionModeCallback = null
            }
        }
    }
}

/**
 * Singleton ActionMode.Callback that unconditionally blocks the copy/paste/cut/
 * select-all floating toolbar from being created or displayed.
 *
 * Implemented as an object (singleton) instead of instantiating a new
 * BlockActionMode per-view, reducing allocations when protecting many children.
 *
 * ── HOW IT WORKS ──────────────────────────────────────────────────────────────
 *   Returning `false` from [onCreateActionMode] tells Android NOT to display the
 *   action mode (toolbar). If false is returned here, Android skips
 *   [onPrepareActionMode] and never shows any menu items.
 *
 * ── THREAD SAFETY ─────────────────────────────────────────────────────────────
 *   This singleton holds no mutable state, so it is safe to share across
 *   multiple views and threads.
 */
private object BlockActionMode : ActionMode.Callback {

    /**
     * Returning `false` cancels creation — the toolbar is never shown.
     *
     * @return Always false.
     */
    override fun onCreateActionMode(mode: ActionMode?, menu: Menu?): Boolean = false

    /**
     * Unreachable in practice (creation always fails), implemented defensively.
     *
     * @return Always false.
     */
    override fun onPrepareActionMode(mode: ActionMode?, menu: Menu?): Boolean = false

    /**
     * Unreachable in practice — no items are ever created.
     *
     * @return Always false.
     */
    override fun onActionItemClicked(mode: ActionMode?, item: MenuItem?): Boolean = false

    /**
     * No clean-up required — this callback holds no state or resources.
     */
    override fun onDestroyActionMode(mode: ActionMode?) = Unit
}
