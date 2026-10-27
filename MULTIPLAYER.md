# Tessera Multiplayer Models

Multiplayer is intentionally separate from the first single-player release. The single-player game should first establish deterministic puzzles, local progress, replayable seeds, and a clear result experience.

## 1. Head-to-head race

Two players join a room and receive the same puzzle configuration. Each player solves a private grid. The first valid solution wins.

Players may see limited opponent progress:

- connected / ready state;
- cells placed;
- lines matched;
- finished state.

They should not see the opponent's actual placements, otherwise the match becomes a copying exercise.

This is the recommended first real-time multiplayer mode. It requires a service to create rooms, synchronize the start, maintain an authoritative clock, validate results, and handle reconnects.

## 2. Cooperative shared board

Players work on one grid together. Every placement is visible to everyone, and players can divide the puzzle between them.

This is easier to understand socially but needs conflict handling when two players place or remove digits at the same time. It is better suited to a later relaxed mode than to competitive play.

## 3. Async challenge

One player shares a deterministic puzzle link. Another player solves the same puzzle independently, and the results are compared later.

This can begin with very little infrastructure because the seed and configuration can live in the URL. A backend becomes useful when results, completion times, or challenge history need to be trusted and synchronized.

## 4. Daily challenge

Everyone receives the same puzzle for a given date. A deterministic date-based seed can make the puzzle identical for all players.

It can work anonymously with local completion tracking. Accounts become useful for cross-device streaks, leaderboards, and preventing a player from submitting multiple scores.

## 5. Best-of-three match

Players compete across several puzzles with a match score. Grid sizes or difficulty levels can vary between rounds.

This should come after the basic race mode because it adds match state, rematches, disconnections, and result aggregation.

## Backend boundary

True real-time multiplayer normally needs a backend for:

- room creation and joining;
- player presence and readiness;
- synchronized start time;
- authoritative match time;
- result verification;
- reconnects and room cleanup;
- optional ratings, history, or leaderboards.

WebRTC can reduce server traffic after a connection is established, but it still needs signaling and often STUN/TURN infrastructure. It is not a genuinely backend-free solution.

## Suggested progression

1. Local single-player with `localStorage` or IndexedDB.
2. Shareable deterministic puzzle links.
3. Async challenge links.
4. Guest real-time race rooms.
5. Optional accounts for synchronized history, streaks, and rankings.
6. Cooperative and best-of-three modes.

Single-player should remain explicit about its privacy boundary: puzzle progress and history stay on the device and are not uploaded. Multiplayer should clearly disclose the different boundary because match data must be shared with the multiplayer service.
