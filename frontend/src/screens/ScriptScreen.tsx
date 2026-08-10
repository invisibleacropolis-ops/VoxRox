import { PixelFrame } from '@/ui/primitives/PixelFrame';
import { PixelPanel } from '@/ui/primitives/PixelPanel';

export function ScriptScreen() {
  return (
    <PixelFrame variant="dashed" style={{ height: '100%' }}>
      <PixelPanel title="Script">
        <div className="vx-empty">
          Script import and multi-character auto-casting land in a later pass.
        </div>
      </PixelPanel>
    </PixelFrame>
  );
}
