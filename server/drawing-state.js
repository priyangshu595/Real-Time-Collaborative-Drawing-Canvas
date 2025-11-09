// drawing-state.js - simple helper (not required by server but included for completeness)
export class DrawingState {
  constructor() {
    this.history = [];
    this.nextSeq = 1;
  }
  add(op) {
    op.seq = this.nextSeq++;
    this.history.push(op);
  }
  get() { return this.history; }
}
