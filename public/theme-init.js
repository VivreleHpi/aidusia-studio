// Anti-flash : pose la classe de theme avant le premier rendu React.
// Fichier externe (pas inline) pour rester compatible avec la CSP stricte
// script-src 'self' — un script inline y est bloque.
(function () {
  try {
    var t = localStorage.getItem("aidusia_theme");
    if (t !== "light" && t !== "dark") {
      t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.classList.add(t);
  } catch {
    /* stockage indisponible : la preference systeme CSS s'applique */
  }
})();
