/**
 * readValue reads one local browser-fixture key without using a service.
 *
 * @param {string} key - The fixture key.
 * @returns {Promise<unknown>} The saved value or null.
 */
const readValue = async (key) => JSON.parse(window.sessionStorage.getItem('fixture:' + key) || 'null');

/**
 * writeValue writes a local fixture key, optionally simulating partial storage failure.
 *
 * @param {string} key - The fixture key.
 * @param {unknown} value - The value to store.
 * @returns {Promise<void>} Resolves after the fixture write.
 */
const writeValue = async (key, value) => {
  if (window.fixtureMode === 'storage-failure' && key === 'user_token' && value !== 'existing-local-token') {
    throw new Error('Local fixture storage failure');
  }
  window.sessionStorage.setItem('fixture:' + key, JSON.stringify(value));
};

/**
 * deleteValue removes one local fixture key.
 *
 * @param {string} key - The fixture key.
 * @returns {Promise<void>} Resolves after removal.
 */
const deleteValue = async (key) => {
  window.sessionStorage.removeItem('fixture:' + key);
};

export default { KvGet: readValue, KvSet: writeValue, KvDel: deleteValue };
