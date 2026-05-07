export const getTwoWordName = (name, fallback = '') => {
    if (!name) return fallback;
    const words = name.trim().split(/\s+/);
    if (words.length === 0) return fallback;
    return words.slice(0, 2).join(' ');
};
