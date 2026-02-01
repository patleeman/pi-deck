import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Encodes a workspace path for use in URLs.
 * Replaces / with ~ to avoid nested route issues.
 */
export function encodeWorkspacePath(path: string): string {
  return encodeURIComponent(path.replace(/\//g, '~'));
}

/**
 * Decodes a workspace path from a URL segment.
 */
export function decodeWorkspacePath(encoded: string): string {
  return decodeURIComponent(encoded).replace(/~/g, '/');
}

interface UseRouteSyncOptions {
  /** Current active workspace path */
  activeWorkspacePath: string | null;
  /** Called when URL indicates a workspace should be opened */
  onOpenWorkspace: (path: string) => void;
  /** Called when URL indicates a workspace should become active (already open) */
  onSetActiveWorkspaceByPath: (path: string) => void;
  /** Check if a workspace is already open */
  isWorkspaceOpen: (path: string) => boolean;
  /** Whether initial restoration from backend is complete */
  restorationComplete: boolean;
}

/**
 * Syncs React Router location with workspace state.
 * 
 * - When workspace changes in app → updates URL
 * - When URL changes (back/forward) → opens workspace or switches to it
 * - Handles initial page load with workspace in URL
 */
export function useRouteSync({
  activeWorkspacePath,
  onOpenWorkspace,
  onSetActiveWorkspaceByPath,
  isWorkspaceOpen,
  restorationComplete,
}: UseRouteSyncOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Track if we're currently handling a navigation to avoid loops
  const isNavigatingRef = useRef(false);
  // Track if initial URL has been processed
  const hasProcessedInitialUrlRef = useRef(false);
  // Track the last path we synced to avoid duplicate navigations
  const lastSyncedPathRef = useRef<string | null>(null);

  // Parse workspace path from current URL
  const getWorkspaceFromUrl = (): string | null => {
    const match = location.pathname.match(/^\/workspace\/(.+)$/);
    if (match) {
      return decodeWorkspacePath(match[1]);
    }
    return null;
  };

  // Handle URL changes (including initial load and back/forward)
  useEffect(() => {
    // Don't process until restoration is complete (to avoid conflicts with backend state)
    if (!restorationComplete) return;
    
    // Avoid re-processing during our own navigation
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      return;
    }

    const urlWorkspace = getWorkspaceFromUrl();
    
    // If URL has a workspace that isn't the active one
    if (urlWorkspace && urlWorkspace !== activeWorkspacePath) {
      if (isWorkspaceOpen(urlWorkspace)) {
        // Already open, just switch to it
        onSetActiveWorkspaceByPath(urlWorkspace);
      } else {
        // Not open, open it (this will also make it active)
        onOpenWorkspace(urlWorkspace);
      }
    }
    
    hasProcessedInitialUrlRef.current = true;
  }, [location.pathname, restorationComplete, activeWorkspacePath, isWorkspaceOpen, onOpenWorkspace, onSetActiveWorkspaceByPath]);

  // Update URL when active workspace changes
  useEffect(() => {
    // Don't update URL until restoration is complete
    if (!restorationComplete) return;
    
    const urlWorkspace = getWorkspaceFromUrl();
    
    if (activeWorkspacePath) {
      const newPath = `/workspace/${encodeWorkspacePath(activeWorkspacePath)}`;
      
      // Only navigate if the path actually changed
      if (location.pathname !== newPath && lastSyncedPathRef.current !== activeWorkspacePath) {
        lastSyncedPathRef.current = activeWorkspacePath;
        isNavigatingRef.current = true;
        
        // Use replace for the initial sync, push for subsequent changes
        if (!hasProcessedInitialUrlRef.current) {
          navigate(newPath, { replace: true });
        } else {
          navigate(newPath);
        }
      }
    } else if (urlWorkspace && location.pathname !== '/') {
      // No active workspace but URL has one - clear URL
      lastSyncedPathRef.current = null;
      isNavigatingRef.current = true;
      navigate('/', { replace: true });
    }
  }, [activeWorkspacePath, restorationComplete, navigate, location.pathname]);

  // Reset sync tracking when location changes externally (back/forward)
  useEffect(() => {
    const urlWorkspace = getWorkspaceFromUrl();
    if (urlWorkspace !== lastSyncedPathRef.current) {
      lastSyncedPathRef.current = urlWorkspace;
    }
  }, [location.pathname]);
}
