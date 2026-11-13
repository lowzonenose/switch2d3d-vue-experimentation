// itowns lit `global` au chargement : ce module doit être évalué avant tout import d'itowns.
globalThis.global ??= globalThis
