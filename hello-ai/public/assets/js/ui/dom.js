/** Tiny element builder: el("div", { class: "x", onclick }, child, "text"). */
export function el(tag, props = {}, ...children) {
  const node = globalThis.document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(value));
  }
  node.append(...children.flat().filter((child) => child != null && child !== false));
  return node;
}
