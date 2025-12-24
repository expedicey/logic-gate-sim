
export type NodeType = 'AND' | 'OR' | 'NOT' | 'INPUT' | 'OUTPUT';

export abstract class CircuitNode {
    id: string;
    type: NodeType;
    inputs: CircuitNode[] = [];
    outputs: CircuitNode[] = [];
    value: boolean = false;
    x: number = 0;
    y: number = 0;

    label: string;
    constructor(id: string, type: NodeType, x: number = 0, y: number = 0, label: string = '') {
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;
        this.label = label || type;
    }

    abstract compute(): boolean;

    addInput(node: CircuitNode) {
        if (!this.inputs.includes(node)) {
            this.inputs.push(node);
            node.outputs.push(this);
        }
    }

    removeInput(node: CircuitNode) {
        const index = this.inputs.indexOf(node);
        if (index !== -1) {
            this.inputs.splice(index, 1);
            const outIndex = node.outputs.indexOf(this);
            if (outIndex !== -1) {
                node.outputs.splice(outIndex, 1);
            }
        }
    }
}

export class InputNode extends CircuitNode {
    constructor(id: string, x: number, y: number, label: string = 'INPUT') {
        super(id, 'INPUT', x, y, label);
    }
    compute(): boolean {
        return this.value; // Value is set externally
    }
    setValue(val: boolean) {
        this.value = val;
    }
}

export class OutputNode extends CircuitNode {
    constructor(id: string, x: number, y: number) {
        super(id, 'OUTPUT', x, y);
    }
    compute(): boolean {
        return this.inputs.length > 0 ? this.inputs[0].value : false;
    }
}

export class AndGate extends CircuitNode {
    constructor(id: string, x: number, y: number) {
        super(id, 'AND', x, y);
    }
    compute(): boolean {
        return this.inputs.every(inp => inp.value);
    }
}

export class OrGate extends CircuitNode {
    constructor(id: string, x: number, y: number) {
        super(id, 'OR', x, y);
    }
    compute(): boolean {
        return this.inputs.some(inp => inp.value);
    }
}

export class NotGate extends CircuitNode {
    constructor(id: string, x: number, y: number) {
        super(id, 'NOT', x, y);
    }
    compute(): boolean {
        return this.inputs.length > 0 ? !this.inputs[0].value : false;
    }
}



export class CycleDetectedError extends Error {
    constructor() {
        super("Cycle Detected: The circuit contains a feedback loop and cannot be simulated strictly combinationally.");
    }
}

export class Circuit {
    nodes: Map<string, CircuitNode> = new Map();

    addNode(node: CircuitNode) {
        this.nodes.set(node.id, node);
    }

    removeNode(nodeId: string) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        // Remove connections
        // We need to iterate carefully.
        // Making copies of arrays to avoid concurrent modification issues
        [...node.inputs].forEach(inp => node.removeInput(inp));
        [...node.outputs].forEach(out => out.removeInput(node));

        this.nodes.delete(nodeId);
    }

    addConnection(fromId: string, toId: string) {
        const from = this.nodes.get(fromId);
        const to = this.nodes.get(toId);
        if (from && to) {
            to.addInput(from);
        }
    }

    /**
     * Kahn's Algorithm for Topological Sort
     * Used to determine the evaluation order of the gates.
     */
    getEvaluationOrder(): CircuitNode[] {
        const inDegree: Map<string, number> = new Map();
        const queue: CircuitNode[] = [];
        const sorted: CircuitNode[] = [];

        // 1. Initialize in-degrees
        this.nodes.forEach(node => {
            inDegree.set(node.id, 0);
        });

        this.nodes.forEach(node => {
            node.outputs.forEach(out => {
                inDegree.set(out.id, (inDegree.get(out.id) || 0) + 1);
            });
        });

        // 2. Enqueue nodes with in-degree 0
        this.nodes.forEach(node => {
            if (inDegree.get(node.id) === 0) {
                queue.push(node);
            }
        });

        // 3. Process queue
        while (queue.length > 0) {
            const u = queue.shift()!;
            sorted.push(u);

            u.outputs.forEach(v => {
                inDegree.set(v.id, (inDegree.get(v.id)! - 1));
                if (inDegree.get(v.id) === 0) {
                    queue.push(v);
                }
            });
        }

        // 4. Cycle Detection check
        if (sorted.length !== this.nodes.size) {
            throw new CycleDetectedError();
        }

        return sorted;
    }

    evaluate() {
        try {
            const order = this.getEvaluationOrder();
            for (const node of order) {
                // Skip InputNodes as they are set manually/externally
                if (node instanceof InputNode) continue;

                node.value = node.compute();
            }
        } catch (e) {
            if (e instanceof CycleDetectedError) {
                console.error(e.message);
                // In a real app, we might bubble this up to the UI
                throw e;
            }
        }
    }

    getTruthTable(): { inputs: Record<string, boolean>, outputs: Record<string, boolean>, inputLabels: Record<string, string> }[] {
        const inputs = Util.getNodesByType<InputNode>(this, 'INPUT');
        const outputs = Util.getNodesByType<OutputNode>(this, 'OUTPUT');
        const results = [];

        const permutations = 1 << inputs.length;
        for (let i = 0; i < permutations; i++) {
            // Set input states
            inputs.forEach((inp, idx) => {
                inp.setValue(!!((i >> idx) & 1));
            });

            // Evaluate
            try {
                this.evaluate();
            } catch (e) {
                // Decide how to handle cycles in truth table (maybe return null)
                return [];
            }

            // Record result
            const row = {
                inputs: {} as Record<string, boolean>,
                outputs: {} as Record<string, boolean>,
                inputLabels: {} as Record<string, string>
            };

            inputs.forEach(inp => {
                row.inputs[inp.id] = inp.value;
                row.inputLabels[inp.id] = inp.label;
            });
            outputs.forEach(out => row.outputs[out.id] = out.value);
            results.push(row);
        }
        return results;
    }
}

export class Util {
    static getNodesByType<T extends CircuitNode>(circuit: Circuit, type: NodeType): T[] {
        return Array.from(circuit.nodes.values()).filter(n => n.type === type) as T[];
    }
}
