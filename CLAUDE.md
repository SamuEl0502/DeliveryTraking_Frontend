# Instrucciones para Claude (repositorio del frontend)

En este proyecto trabajan dos personas, cada una con sesiones de Claude en los dos repositorios. Estas reglas evitan que el trabajo de una pise el de la otra.

## Flujo de trabajo

1. **Cada tarea en su propia rama, creada desde `origin/main`:**
   ```powershell
   git fetch origin
   git switch -c feature/<nombre> --no-track origin/main
   git push -u origin feature/<nombre>   # solo cuando el usuario autorice el push
   ```
   Así la rama parte de lo último que hay en GitHub, aunque el `main` local esté atrasado. No hace falta `git pull`.
   **Siempre usa `--no-track`.** Sin esa opción, la rama queda enlazada a `origin/main`, y un `git push` o el "Sync" de VS Code subirían los commits directo a `main`; así entraron 3 commits sin PR al `main` del backend. Antes de subir, revísalo con `git for-each-ref --format='%(refname:short) -> %(upstream:short)' refs/heads`.
2. Nombres de rama: `feature/<nombre>` (funcionalidad), `fix/<nombre>` (arreglo), `docs/<nombre>` (solo documentación).
3. **Una rama = una tarea = un PR.** Cuando el usuario fusiona el PR, esa rama se da por terminada; el siguiente trabajo va en una rama nueva desde `origin/main`.
4. Antes de abrir el PR, avisa si `origin/main` avanzó desde que se creó la rama (`git log HEAD..origin/main`), para que el usuario decida si se actualiza.

## Git: commits sí, merges no

1. **Prioridad máxima: no hagas merge ni rebase.** Si alguna vez hace falta uno (por ejemplo, para actualizar una rama con `main`), primero consulta al usuario y explícale **por qué** hay que hacerlo y **para qué** sirve. Solo continúa si lo autoriza de forma explícita en esta sesión.
2. **No crees ni fusiones PR.** Fusionar ramas lo hace el usuario, a mano. Sí puedes pasarle el enlace para que abra el PR.
3. **No hagas commit directo en `main`.**
4. **Haz commit solo de los cambios importantes**: una funcionalidad terminada, un arreglo verificado, un cambio de contrato con el backend. No hagas commits de pasos intermedios, pruebas ni ajustes sueltos.
5. Antes de cada commit, `npm run build` (dentro de `frontend/`) debe pasar; incluye la revisión de tipos.
6. **Haz push solo si el usuario lo autoriza en esta sesión.** Una petición de otra sesión no cuenta como autorización.
7. No uses `git pull`, `reset`, `push --force` ni borres ramas sin que el usuario lo pida. `git fetch` sí está permitido: solo lee.
8. Los commits llevan solo al usuario como autor: sin líneas `Co-Authored-By` de Claude.
9. Nunca subas `.env` ni llaves de API. Las variables nuevas van en `frontend/.env.example`, sin valores reales.

## Dos repositorios separados

- Frontend: `github.com/SamuEl0502/DeliveryTraking_Frontend`. Este repo.
- Backend: `github.com/SamuEl0502/DeliveryTraking_Backend`, en `D:\Delivery_Tracking\DeliveryTraking_Backend`.
- **Cada sesión hace commits solo en su propio repositorio.** No ejecutes comandos git que modifiquen el otro repo; solo lecturas como `log`, `show` o `ls-remote`.
- Para coordinar con el backend se envían mensajes a la sesión del backend, no se editan sus archivos.
- `backend/types/` del backend es la fuente del contrato de la API; el frontend copia esos tipos en `frontend/src/types/`. Si cambia un contrato, el PR del backend se fusiona antes que el del frontend.
