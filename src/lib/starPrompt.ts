/* Rappel de soutien (étoile GitHub), volontairement respectueux : aucune
   requête réseau, aucun tracking — tout l'état vit dans localStorage (préfixe
   aidusia_, donc couvert par l'export et la remise à zéro des données). Le
   rappel n'apparaît qu'après plusieurs réponses menées à terme (l'utilisateur
   a reçu de la valeur avant qu'on lui demande quoi que ce soit), jamais
   pendant une génération ni sur une erreur, et se tait définitivement après
   un refus explicite ou deux reports. */

const STORAGE_KEY = "aidusia_star_prompt_v1"; // gitleaks:allow — nom de clé localStorage, pas un secret
const FIRST_THRESHOLD = 3; // réponses réussies avant le premier affichage
const SNOOZE_RESPONSES = 8; // « Plus tard » = revoir dans 8 réponses
const MAX_SNOOZES = 2; // au-delà, on considère que la réponse est non

export interface StarPromptState {
  count: number; // réponses assistant menées à terme
  next: number; // seuil (en réponses) du prochain affichage
  snoozes: number; // « Plus tard » déjà utilisés
  done: boolean; // terminal : étoilé, refusé ou trop de reports
}

const DEFAULT_STATE: StarPromptState = {
  count: 0,
  next: FIRST_THRESHOLD,
  snoozes: 0,
  done: false,
};

function isValidState(value: unknown): value is StarPromptState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.count === "number" && Number.isFinite(v.count) && v.count >= 0 &&
    typeof v.next === "number" && Number.isFinite(v.next) && v.next >= 0 &&
    typeof v.snoozes === "number" && Number.isFinite(v.snoozes) && v.snoozes >= 0 &&
    typeof v.done === "boolean"
  );
}

export function loadStarPromptState(): StarPromptState {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "");
    if (isValidState(parsed)) return parsed;
  } catch {
    // stockage vide, corrompu ou indisponible : repartir de zéro
  }
  return DEFAULT_STATE;
}

function save(state: StarPromptState): StarPromptState {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // stockage indisponible (mode privé strict…) : le rappel restera discret
  }
  return state;
}

// Une réponse assistant menée à terme (streaming terminé sans erreur).
// Après un état terminal, le compte cesse d'évoluer : plus rien à décider.
export function recordCompletedResponse(): StarPromptState {
  const state = loadStarPromptState();
  if (state.done) return state;
  return save({ ...state, count: state.count + 1 });
}

export function shouldShowStarPrompt(state: StarPromptState): boolean {
  return !state.done && state.count >= state.next;
}

export function snoozeStarPrompt(): StarPromptState {
  const state = loadStarPromptState();
  const snoozes = state.snoozes + 1;
  if (snoozes >= MAX_SNOOZES) return save({ ...state, snoozes, done: true });
  return save({ ...state, snoozes, next: state.count + SNOOZE_RESPONSES });
}

// Refus explicite OU étoile donnée : dans les deux cas on ne redemande jamais
// (impossible de vérifier l'étoile sans appeler GitHub — on fait confiance).
export function dismissStarPrompt(): StarPromptState {
  return save({ ...loadStarPromptState(), done: true });
}
