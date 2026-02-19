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
 * A Fabric-compatible ReactViewGroup that disables copy/paste
 * for all TextView and EditText children recursively.
 *
 * Extends ReactViewGroup (not plain ViewGroup) so Fabric's
 * SurfaceMountingManager can correctly cast it via IViewGroupManager.
 */
class SecureView(context: Context) : ReactViewGroup(context) {

    private var isCopyPasteDisabled = false

    fun disableCopyPaste() {
        isCopyPasteDisabled = true
        applyToChildren(this)
    }

    fun enableCopyPaste() {
        isCopyPasteDisabled = false
        restoreChildren(this)
    }

    /**
     * Called by Fabric's SurfaceMountingManager when a child is mounted.
     * Signature must be (child: View) — non-nullable — to match ViewGroup.
     */
    override fun onViewAdded(child: View) {
        super.onViewAdded(child)
        if (isCopyPasteDisabled) {
            applyToView(child)
            // Also recurse into the child if it's already a group
            if (child is ViewGroup) applyToChildren(child)
        }
    }

    // ── Recursive helpers ─────────────────────────────────────

    private fun applyToChildren(group: ViewGroup) {
        for (i in 0 until group.childCount) {
            val child = group.getChildAt(i)
            applyToView(child)
            if (child is ViewGroup) applyToChildren(child)
        }
    }

    private fun restoreChildren(group: ViewGroup) {
        for (i in 0 until group.childCount) {
            val child = group.getChildAt(i)
            restoreView(child)
            if (child is ViewGroup) restoreChildren(child)
        }
    }

    private fun applyToView(view: View) {
        when (view) {
            is EditText -> {
                view.isLongClickable = false
                view.setTextIsSelectable(false)
                view.customSelectionActionModeCallback = BlockActionMode()
                view.customInsertionActionModeCallback = BlockActionMode()
            }
            is TextView -> {
                view.isLongClickable = false
                view.setTextIsSelectable(false)
                view.customSelectionActionModeCallback = BlockActionMode()
            }
        }
    }

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

// Blocks the copy/paste/cut context menu from appearing
private class BlockActionMode : ActionMode.Callback {
    override fun onCreateActionMode(mode: ActionMode?, menu: Menu?): Boolean = false
    override fun onPrepareActionMode(mode: ActionMode?, menu: Menu?): Boolean = false
    override fun onActionItemClicked(mode: ActionMode?, item: MenuItem?): Boolean = false
    override fun onDestroyActionMode(mode: ActionMode?) = Unit
}