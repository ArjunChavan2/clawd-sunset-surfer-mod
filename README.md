# clawd sunset surfer mod

A [Claude Code](https://claude.com/claude-code) mod that draws above your prompt while Claude works. Pick an act:

- **Clawd** (default): the Claude Code mascot acts out what's happening: detective, cooking, herding sheep, wizard and more.
- **Sunset surfer**: a 3-lane endless runner seen from behind Clawd, with a synthwave sunset, haze, and shaded 3D obstacles. An autopilot changes lanes and jumps over bars, slides under gates and hops onto platforms.

Neither act uses any tokens: the hooks only observe and draw. (Only `/clawd <message>` makes one small Haiku call.)

## Install

In Claude Code:

```
/plugin marketplace add ArjunChavan2/clawd-sunset-surfer-mod
/plugin install clawd-mods@clawd-mods
/reload-plugins
```

## Use

| Command | Effect |
|---|---|
| `/runner` | Toggle between Clawd and the sunset surfer (remembered across sessions) |
| `/runner clawd` / `/runner runner` | Pick one |
| `/clawd pet` `feed` `wave` `dance` | Interact with Clawd (Clawd act only) |
| `/clawd <message>` | Chat in a speech bubble (one small Haiku call) |

Needs a terminal with 24-bit color for the runner's gradients (iTerm2, Ghostty, Kitty, WezTerm). It draws only in the terminal and Desktop Code tab, not the VS Code chat panel or `claude -p`.

## Develop

```
claude plugin validate .
claude plugin test .
```

The runner is `hooks/world.ts` (a pure function of the tick, so it's testable); the band and `/runner` switch are in `hooks/register.tsx`.

## Credits

Built on [clawd-actor](https://github.com/BrianHuang813/clawd-actor) by Brian Huang (MIT): the Clawd scenes and `/clawd` chat are his. The runner and the switch are additions; upstream's update check was removed. Fan-made, not affiliated with Anthropic. MIT, see `LICENSE`.
