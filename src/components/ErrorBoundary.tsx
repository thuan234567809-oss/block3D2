import React from 'react';
import { deleteSavedWorld } from '../storage/worldSave';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, message: '' };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message || 'Unexpected rendering error.' };
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleResetSave = async (): Promise<void> => {
    await deleteSavedWorld().catch(() => {});
    window.location.reload();
  };

  public render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0d1117] text-stone-100 p-6">
        <div className="voxel-panel max-w-md w-full rounded p-6 flex flex-col gap-4">
          <h1 className="font-display font-bold text-xl text-amber-400">BLOCKWORLD Recovery</h1>
          <p className="text-sm text-stone-300 leading-relaxed">
            The renderer encountered an unexpected error: <span className="font-mono-num text-stone-100">{this.state.message}</span>
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={this.handleReload} className="flex-1 px-4 py-2 voxel-btn-amber rounded font-display font-bold text-sm cursor-pointer">
              Reload Game
            </button>
            <button type="button" onClick={this.handleResetSave} className="flex-1 px-4 py-2 voxel-btn-stone rounded font-display font-semibold text-sm cursor-pointer">
              Clear Save & Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
