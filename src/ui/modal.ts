
export class ModalManager {
    private overlay: HTMLElement;
    private content: HTMLElement;
    private onClose: () => void;

    constructor() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.overlay.style.display = 'none'; // Hidden by default

        this.content = document.createElement('div');
        this.content.className = 'modal-content';
        this.overlay.appendChild(this.content);

        document.body.appendChild(this.overlay);

        // Close on click outside
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        this.onClose = () => { };
    }

    open(htmlContent: string | HTMLElement, onClose?: () => void) {
        this.content.innerHTML = '';
        if (typeof htmlContent === 'string') {
            this.content.innerHTML = htmlContent;
        } else {
            this.content.appendChild(htmlContent);
        }
        this.overlay.style.display = 'flex';
        if (onClose) this.onClose = onClose;
    }

    close() {
        this.overlay.style.display = 'none';
        this.onClose();
    }

    // --- Static Generators for Specific Modals ---

    static generateTruthTableHTML(data: { inputs: Record<string, boolean>, outputs: Record<string, boolean> }[]): HTMLElement {
        const wrapper = document.createElement('div');

        // Headers
        if (data.length === 0) {
            wrapper.innerHTML = "<h3>No inputs/outputs found to generate a table.</h3>";
            return wrapper;
        }

        const firstRow = data[0];
        const inputKeys = Object.keys(firstRow.inputs).sort();
        const outputKeys = Object.keys(firstRow.outputs).sort();

        const table = document.createElement('table');
        table.className = 'truth-table';

        // Head
        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        inputKeys.forEach(k => {
            const th = document.createElement('th');
            th.innerText = k.substring(0, 4); // Shorten ID
            trHead.appendChild(th);
        });
        outputKeys.forEach(k => {
            const th = document.createElement('th');
            th.innerText = "OUT"; // Shorten
            th.classList.add('output-col');
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        data.forEach(row => {
            const tr = document.createElement('tr');
            inputKeys.forEach(k => {
                const td = document.createElement('td');
                td.innerText = row.inputs[k] ? '1' : '0';
                td.classList.add(row.inputs[k] ? 'val-1' : 'val-0');
                tr.appendChild(td);
            });
            outputKeys.forEach(k => {
                const td = document.createElement('td');
                td.innerText = row.outputs[k] ? '1' : '0';
                td.classList.add(row.outputs[k] ? 'val-1' : 'val-0');
                td.classList.add('output-col');
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrapper.appendChild(table);

        return wrapper;
    }

    static generateSynthesisUI(onBuild: (inputCount: number, targets: boolean[]) => void): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<h2>Circuit Synthesis</h2>
      <div class="control-row">
        <label>Inputs:</label>
        <select id="syn-inputs">
            <option value="2">2 (A, B)</option>
            <option value="3">3 (A, B, C)</option>
            <option value="4">4 (A, B, C, D)</option>
        </select>
      </div>
      <div id="syn-table-container"></div>
      <button id="btn-build-syn" style="margin-top: 15px;">Build Circuit</button>
      `;

        const select = wrapper.querySelector('#syn-inputs') as HTMLSelectElement;
        const container = wrapper.querySelector('#syn-table-container') as HTMLElement;

        const renderTable = () => {
            container.innerHTML = '';
            const count = parseInt(select.value);
            const rows = 1 << count;

            const table = document.createElement('table');
            table.className = 'truth-table editable';

            // Header
            const trH = document.createElement('tr');
            for (let i = 0; i < count; i++) {
                const th = document.createElement('th');
                th.innerText = String.fromCharCode(65 + i);
                trH.appendChild(th);
            }
            const thOut = document.createElement('th');
            thOut.innerText = "OUT";
            trH.appendChild(thOut);
            table.appendChild(trH);

            // Rows
            for (let i = 0; i < rows; i++) {
                const tr = document.createElement('tr');
                // Inputs (Read-only)
                for (let j = 0; j < count; j++) {
                    const td = document.createElement('td');
                    // specific bit logic
                    // High bit is A (index 0). So for 2 vars (A, B), A is bit 1, B is bit 0.
                    // (i >> (count - 1 - j))
                    const val = (i >> (count - 1 - j)) & 1;
                    td.innerText = val.toString();
                    td.classList.add(val ? 'val-1' : 'val-0');
                    tr.appendChild(td);
                }
                // Output (Editable)
                const tdOut = document.createElement('td');
                tdOut.className = 'editable-cell val-0';
                tdOut.innerText = '0';
                tdOut.onclick = () => {
                    const updated = tdOut.innerText === '0' ? '1' : '0';
                    tdOut.innerText = updated;
                    tdOut.className = `editable-cell val-${updated}`;
                };
                tr.appendChild(tdOut);
                table.appendChild(tr);
            }
            container.appendChild(table);
        };

        select.addEventListener('change', renderTable);
        renderTable(); // Initial

        const btn = wrapper.querySelector('#btn-build-syn');
        btn?.addEventListener('click', () => {
            const cells = container.querySelectorAll('.editable-cell');
            const targets: boolean[] = [];
            cells.forEach(c => targets.push(c.innerText === '1'));
            onBuild(parseInt(select.value), targets);
        });

        return wrapper;
    }
}
