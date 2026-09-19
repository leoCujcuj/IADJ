/**
 * Estado compartido en memoria para el contador de intervenciones del DJ.
 */

const chatState = {
  songsSinceLastDJIntervention: 1,
  get count() {
    return this.songsSinceLastDJIntervention;
  },
  set count(val) {
    this.songsSinceLastDJIntervention = val;
  },
  reset() {
    this.songsSinceLastDJIntervention = 1;
  },
  resetDJIntervention() {
    this.songsSinceLastDJIntervention = 1;
  },
  increment() {
    this.songsSinceLastDJIntervention++;
  },
  decrement() {
    if (this.songsSinceLastDJIntervention > 1) {
      this.songsSinceLastDJIntervention--;
    }
  },
  resetToZero() {
    this.songsSinceLastDJIntervention = 0;
  }
};

module.exports = chatState;
module.exports.resetDJIntervention = () => chatState.reset();
module.exports.getSongsSinceLastDJIntervention = () => chatState.count;
module.exports.setSongsSinceLastDJIntervention = (val) => { chatState.count = val; };
module.exports.incrementDJIntervention = () => chatState.increment();
