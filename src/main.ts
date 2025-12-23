
import './styles/main.css'
import { CanvasManager } from './ui/canvas'

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container') as HTMLElement;
  const svgLayer = document.getElementById('connections-layer') as unknown as SVGSVGElement;

  if (container && svgLayer) {
    new CanvasManager(container, svgLayer);
  }
});
