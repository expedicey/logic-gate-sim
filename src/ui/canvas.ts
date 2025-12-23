
import { Circuit, CircuitNode, type NodeType, AndGate, OrGate, NotGate, XorGate, InputNode, OutputNode, CycleDetectedError } from '../core/engine';
import { ModalManager } from './modal';
import { SynthesisEngine } from '../core/synthesis';

export class CanvasManager {
    private circuit: Circuit;
    private container: HTMLElement;
    private panLayer: HTMLElement | null;
    private svgLayer: SVGSVGElement;
    private draggedNodeId: string | null = null;
    private initialMousePos = { x: 0, y: 0 };
    private initialNodePos = { x: 0, y: 0 };

    private panOffset = { x: 0, y: 0 };
    private isPanning = false;
    private panStart = { x: 0, y: 0 };

    private isDrawingWire = false;
    private wireStartNode: CircuitNode | null = null;
    private tempWire: SVGPathElement | null = null;

    private modalManager: ModalManager;

    constructor(container: HTMLElement, svgLayer: SVGSVGElement) {
        this.circuit = new Circuit();
        this.container = container;
        this.svgLayer = svgLayer;
        this.panLayer = document.getElementById('pan-layer');
        this.modalManager = new ModalManager();

        this.setupEventListeners();
        this.setupSidebarEvents();
        this.setupCanvasNavigation();

        this.resizeSvg();
        window.addEventListener('resize', () => this.resizeSvg());
    }

    private resizeSvg() {
        // Large SVG for panning
        this.svgLayer.setAttribute('width', '5000');
        this.svgLayer.setAttribute('height', '5000');
    }

    // --- Canvas Navigation ---

    private setupCanvasNavigation() {
        this.container.addEventListener('mousedown', (e) => {
            if ((e.target as HTMLElement).closest('.gate')) return;
            if (e.target === this.container || e.target === this.panLayer || e.target === this.svgLayer) {
                this.isPanning = true;
                this.panStart = { x: e.clientX - this.panOffset.x, y: e.clientY - this.panOffset.y };
                this.container.style.cursor = 'grabbing';
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isPanning && this.panLayer) {
                this.panOffset.x = e.clientX - this.panStart.x;
                this.panOffset.y = e.clientY - this.panStart.y;
                this.updateTransform();
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                this.container.style.cursor = 'grab';
            }
        });

        const btnClear = document.getElementById('btn-clear');
        if (btnClear) {
            btnClear.addEventListener('click', () => this.clearAll());
        }
    }

    private updateTransform() {
        if (this.panLayer) {
            this.panLayer.style.transform = `translate(${this.panOffset.x}px, ${this.panOffset.y}px)`;
        }
        this.container.style.backgroundPosition = `${this.panOffset.x % 20}px ${this.panOffset.y % 20}px`;
    }

    private clearAll() {
        this.circuit = new Circuit();
        const gates = this.panLayer?.querySelectorAll('.gate');
        gates?.forEach(g => g.remove());
        this.redrawWires();
    }

    public loadCircuit(newCircuit: Circuit) {
        this.clearAll();
        this.circuit = newCircuit;

        // Render all nodes
        this.circuit.nodes.forEach(node => {
            this.renderNode(node);
        });
        // Initial eval
        this.updateSimulation();
    }

    // --- Sidebar & Create ---

    private setupSidebarEvents() {
        const items = document.querySelectorAll('.component-item');
        items.forEach(item => {
            item.addEventListener('dragstart', (e: Event) => {
                const type = (item as HTMLElement).dataset.type;
                if (type && e instanceof DragEvent && e.dataTransfer) {
                    e.dataTransfer.setData('type', type);
                }
            });
        });

        this.container.addEventListener('dragover', (e) => e.preventDefault());
        this.container.addEventListener('drop', (e) => this.handleDrop(e));
    }

    private handleDrop(e: DragEvent) {
        e.preventDefault();
        const type = e.dataTransfer?.getData('type') as NodeType;
        if (!type) return;

        const rect = this.container.getBoundingClientRect();
        const x = e.clientX - rect.left - this.panOffset.x;
        const y = e.clientY - rect.top - this.panOffset.y;

        this.createNode(type, x, y);
    }

    private createNode(type: NodeType, x: number, y: number) {
        const id = crypto.randomUUID();
        let node: CircuitNode;

        switch (type) {
            case 'AND': node = new AndGate(id, x, y); break;
            case 'OR': node = new OrGate(id, x, y); break;
            case 'NOT': node = new NotGate(id, x, y); break;
            case 'XOR': node = new XorGate(id, x, y); break;
            case 'INPUT': node = new InputNode(id, x, y); break;
            case 'OUTPUT': node = new OutputNode(id, x, y); break;
            default: return;
        }

        this.circuit.addNode(node);
        this.renderNode(node);
    }

    private renderNode(node: CircuitNode) {
        const el = document.createElement('div');
        el.className = 'gate';
        el.dataset.id = node.id;
        el.dataset.type = node.type;
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;

        const label = document.createElement('span');
        label.className = 'label';
        label.innerText = node.type;
        el.appendChild(label);

        if (node.type !== 'INPUT') {
            const inputPin = document.createElement('div');
            inputPin.className = 'pin input';
            (inputPin as any).nodeId = node.id;
            inputPin.addEventListener('mouseup', (e) => this.handleWireEnd(e, node));
            el.appendChild(inputPin);
        }

        if (node.type !== 'OUTPUT') {
            const outputPin = document.createElement('div');
            outputPin.className = 'pin output';
            (outputPin as any).nodeId = node.id;
            outputPin.addEventListener('mousedown', (e) => this.handleWireStart(e, node));
            el.appendChild(outputPin);
        }

        el.addEventListener('mousedown', (e) => {
            if ((e.target as HTMLElement).classList.contains('pin')) return;
            this.startDragNode(e, node, el);
        });

        if (node.type === 'INPUT') {
            el.addEventListener('click', () => {
                if (this.draggedNodeId) return;
                const val = !node.value;
                (node as InputNode).setValue(val);
                this.updateSimulation();
            });
        }

        this.panLayer?.appendChild(el);
    }

    private startDragNode(e: MouseEvent, node: CircuitNode, el: HTMLElement) {
        this.draggedNodeId = node.id;
        this.initialMousePos = { x: e.clientX, y: e.clientY };
        this.initialNodePos = { x: node.x, y: node.y };

        const onMove = (em: MouseEvent) => {
            const dx = em.clientX - this.initialMousePos.x;
            const dy = em.clientY - this.initialMousePos.y;

            node.x = this.initialNodePos.x + dx;
            node.y = this.initialNodePos.y + dy;
            el.style.left = `${node.x}px`;
            el.style.top = `${node.y}px`;
            this.redrawWires();
        };

        const onUp = () => {
            this.draggedNodeId = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    // --- Wire Management ---

    private handleWireStart(e: MouseEvent, node: CircuitNode) {
        e.stopPropagation();
        e.preventDefault();
        this.isDrawingWire = true;
        this.wireStartNode = node;

        this.tempWire = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.tempWire.setAttribute('class', 'wire wire-preview');
        this.svgLayer.appendChild(this.tempWire);

        const onMove = (em: MouseEvent) => {
            this.updateTempWire(em);
        };

        const onUp = () => {
            this.isDrawingWire = false;
            if (this.tempWire) {
                this.tempWire.remove();
                this.tempWire = null;
            }
            this.wireStartNode = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    private updateTempWire(e: MouseEvent) {
        if (!this.tempWire || !this.wireStartNode) return;

        const rect = this.container.getBoundingClientRect();
        const startX = this.wireStartNode.x + 60;
        const startY = this.wireStartNode.y + 20;
        const mouseX = e.clientX - rect.left - this.panOffset.x;
        const mouseY = e.clientY - rect.top - this.panOffset.y;

        const d = this.calculateBezier(startX, startY, mouseX, mouseY);
        this.tempWire.setAttribute('d', d);
    }

    private handleWireEnd(e: MouseEvent, targetNode: CircuitNode) {
        e.stopPropagation();
        if (this.isDrawingWire && this.wireStartNode && this.wireStartNode !== targetNode) {
            this.circuit.addConnection(this.wireStartNode.id, targetNode.id);
            this.redrawWires();
            this.updateSimulation();
        }
    }

    private calculateBezier(x1: number, y1: number, x2: number, y2: number): string {
        const cx1 = x1 + 50;
        const cx2 = x2 - 50;
        return `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
    }

    private redrawWires() {
        const wires = this.svgLayer.querySelectorAll('.wire:not(.wire-preview)');
        wires.forEach(w => w.remove());

        this.circuit.nodes.forEach(node => {
            node.inputs.forEach(inputNode => {
                this.drawConnection(inputNode, node);
            });
        });
    }

    private drawConnection(from: CircuitNode, to: CircuitNode) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        const startX = from.x + (from.type === 'OUTPUT' ? 40 : 60);
        const startY = from.y + 20;
        const endX = to.x;
        const endY = to.y + 20;

        const d = this.calculateBezier(startX, startY, endX, endY);
        path.setAttribute('d', d);

        const isActive = from.value;
        path.setAttribute('class', `wire ${isActive ? 'active' : ''}`);

        this.svgLayer.appendChild(path);
    }

    // --- Simulation ---

    private updateSimulation() {
        const statusEl = document.getElementById('status-msg');
        if (statusEl) statusEl.innerText = "";

        try {
            this.circuit.evaluate();
            this.updateUIState();
        } catch (e) {
            if (e instanceof CycleDetectedError) {
                if (statusEl) statusEl.innerText = "Error: Feedback Loop Detected!";
            } else {
                console.error(e);
            }
        }
    }

    private updateUIState() {
        this.circuit.nodes.forEach(node => {
            const el = document.querySelector(`.gate[data-id="${node.id}"]`);
            if (el) {
                if (node.value) el.classList.add('on');
                else el.classList.remove('on');
            }
        });
        this.redrawWires();
    }

    private setupEventListeners() {
        // Truth Table Button
        const btn = document.getElementById('btn-truth-table');
        if (btn) {
            btn.addEventListener('click', () => {
                const table = this.circuit.getTruthTable();
                const html = ModalManager.generateTruthTableHTML(table);
                this.modalManager.open(html);
            });
        }

        // Synthesis Button
        const btnSyn = document.getElementById('btn-synthesis');
        if (btnSyn) {
            btnSyn.addEventListener('click', () => {
                const ui = ModalManager.generateSynthesisUI((count, targets) => {
                    const newCircuit = SynthesisEngine.generateCircuit(count, targets);
                    this.loadCircuit(newCircuit);
                    this.modalManager.close();
                });
                this.modalManager.open(ui);
            });
        }
    }
}
