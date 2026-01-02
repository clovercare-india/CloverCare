// Temporary storage for objects that can't be serialized in navigation params
// Used for storing Firebase confirmationResult between screens

let tempStorage = {};

export const setTempData = (key, value) => {
  tempStorage[key] = value;
};

export const getTempData = (key) => {
  return tempStorage[key];
};

export const clearTempData = (key) => {
  delete tempStorage[key];
};

export const clearAllTempData = () => {
  tempStorage = {};
};
