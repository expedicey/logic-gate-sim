
import { Circuit, InputNode, OutputNode, AndGate, OrGate, NotGate, CircuitNode } from './engine';

export class SynthesisEngine {
    /**
     * Generates a Sum-of-Products circuit
     * @param inputCount Number of variables (A, B...)
     * @param outputs Array of boolean desired outputs for each row (0 to 2^N - 1)
     */
    static generateCircuit(inputCount: number, outputs: boolean[]): Circuit {
        const circuit = new Circuit();
        const startX = 100;
        const startY = 100;


        // 1. Create Inputs
        const inputs: InputNode[] = [];
        for (let i = 0; i < inputCount; i++) {
            const id = `INPUT_${i}`;
            // Vertical placement on left
            const node = new InputNode(id, startX, startY + (i * 120));
            circuit.addNode(node);
            inputs.push(node);
        }

        // 2. Identify Minterms (Rows where output is 1)
        const minterms: number[] = [];
        outputs.forEach((out, idx) => {
            if (out) minterms.push(idx);
        });

        if (minterms.length === 0) {
            // Always 0 -> Just connect an input to nothing, or output constant 0.
            // For visual simplicity, let's just make a disconnected Output.
            const out = new OutputNode('OUTPUT_FINAL', startX + 600, startY + 200);
            circuit.addNode(out);
            return circuit;
        }

        // 3. Create AND gates for each minterm
        const andGates: CircuitNode[] = [];
        minterms.forEach((rowIdx, mIdx) => {
            const andGate = new AndGate(`AND_${mIdx}`, startX + 300, startY + (mIdx * 80));
            circuit.addNode(andGate);
            andGates.push(andGate);

            // Connect inputs to this AND gate
            // Check each bit of rowIdx
            for (let bit = 0; bit < inputCount; bit++) {
                // High bit is Input 0.
                // rowIdx: 101 (5). Input 0=1, Input 1=0, Input 2=1.
                const isOne = (rowIdx >> (inputCount - 1 - bit)) & 1;
                const inputNode = inputs[bit];

                if (isOne) {
                    circuit.addConnection(inputNode.id, andGate.id);
                } else {
                    // Need a NOT gate
                    // Reuse NOT gates? Or create fresh ones for simplicity?
                    // Fresh ones avoids crossing wire mess for now, though less efficient.
                    const notId = `NOT_${mIdx}_${bit}`;
                    const notGate = new NotGate(notId, startX + 200, andGate.y + (bit * 10) - 20); // offset slightly
                    circuit.addNode(notGate);

                    circuit.addConnection(inputNode.id, notId);
                    circuit.addConnection(notId, andGate.id);
                }
            }
        });

        // 4. OR all minterms
        const orGate = new OrGate('OR_FINAL', startX + 500, startY + 200);
        circuit.addNode(orGate);
        andGates.forEach(g => circuit.addConnection(g.id, orGate.id));

        // 5. Final Output
        const finalOut = new OutputNode('OUTPUT', startX + 600, orGate.y);
        circuit.addNode(finalOut);
        circuit.addConnection(orGate.id, finalOut.id);

        return circuit;
    }
}
