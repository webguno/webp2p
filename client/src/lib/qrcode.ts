export function generateQRCode(text: string): string {
  // Simple QR code generation using a data URL
  // This creates a basic grid pattern for demonstration
  const size = 200;
  const modules = 25;
  const moduleSize = size / modules;
  
  // Create a simple pattern based on the text
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);
  
  // Black modules based on text hash
  ctx.fillStyle = '#000000';
  
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      // Create a simple pattern based on text and position
      const hash = simpleHash(text + row + col);
      if (hash % 2 === 0) {
        ctx.fillRect(
          col * moduleSize,
          row * moduleSize,
          moduleSize,
          moduleSize
        );
      }
    }
  }
  
  // Add position markers (corners)
  drawPositionMarker(ctx, 0, 0, moduleSize);
  drawPositionMarker(ctx, (modules - 7) * moduleSize, 0, moduleSize);
  drawPositionMarker(ctx, 0, (modules - 7) * moduleSize, moduleSize);
  
  return canvas.toDataURL();
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function drawPositionMarker(ctx: CanvasRenderingContext2D, x: number, y: number, moduleSize: number) {
  // Draw 7x7 position marker
  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, 7 * moduleSize, 7 * moduleSize);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + moduleSize, y + moduleSize, 5 * moduleSize, 5 * moduleSize);
  
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + 2 * moduleSize, y + 2 * moduleSize, 3 * moduleSize, 3 * moduleSize);
}

export function getShareUrl(roomCode: string): string {
  return `${window.location.origin}?room=${roomCode}`;
}
