@AGENTS.md

## Claude Code notes

- All project rules live in `AGENTS.md` (imported above) so every agent tool reads the same rules.
  Change them there, not here.
- **Delegate by size** (see `docs/issues.md`): mechanical edits → Haiku, contained features or
  fixes → Sonnet, cross-cutting or security-sensitive work (auth, hosting, data model) → Opus after a
  plan. Give executors exact files, the contract to match and a verification command; review the
  diff and re-run the check before pushing.
- **Parallel work:** split tasks so no two agents edit the same file (e.g. `village.py` +
  `services.py` vs. `vendor.py` vs. `src/`).
- **Check changes in the real app:** run the API (`cd api && uv run uvicorn app.main:app --port
  8000`) and the UI (`npm run dev`), then use Playwright or Claude in Chrome on
  http://localhost:5173, including the browser console. Reseed (`uv run python -m app.seed`) after
  any test that changes data.
- **Live AI:** needs `ANTHROPIC_API_KEY` in `api/.env`; restart the API after changing `.env`.
  Current Claude models reject `temperature`; read only `text` blocks from the reply.
- **Push when verified:** commit and push each verified change right away; don't batch.
