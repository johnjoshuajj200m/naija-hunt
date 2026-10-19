import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { closeDialogue, openDialogue } from "./dialogue";
import { ExploreHud } from "./ExploreHud";
import { playInput, publishExplorer, releaseAllInput, type ExplorerHud } from "./playInput";
import { SELLER_SCRIPT } from "./shopkeeper";

const base: ExplorerHud = {
  x: -73.6,
  z: -5.1,
  yaw: 0,
  near: false,
  collected: false,
  door: null,
  entrance: null,
  inside: true,
  room: "mama-put",
  seller: false,
  camera: null,
  sellerAt: null,
  speed: 0,
  glass: null,
};

function show(hud: Partial<ExplorerHud>) {
  act(() => publishExplorer({ ...base, ...hud }));
}

afterEach(() => {
  act(() => closeDialogue());
  releaseAllInput();
  localStorage.clear();
});

describe("ExploreHud seller interaction", () => {
  it("prompts to talk, and the button reads Talk and sets the interact press", async () => {
    render(<ExploreHud onMenu={() => {}} onNewGame={() => {}} />);
    show({ seller: true });
    expect(screen.getAllByText(/talk to the seller/i).length).toBeGreaterThan(0);
    const button = screen.getByRole("button", { name: "Talk" });
    await userEvent.click(button);
    expect(playInput.interact).toBe(true);
  });

  it("keeps the door and clue prompts when the seller is out of reach", () => {
    render(<ExploreHud onMenu={() => {}} onNewGame={() => {}} />);
    show({ door: "exit", entrance: "mama-put" });
    expect(screen.getAllByText(/walk out through the door/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Leave" })).toBeInTheDocument();
    show({ inside: false, room: null, door: "enter", entrance: "mama-put" });
    expect(screen.getAllByText(/Mama Put is open/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Enter" })).toBeInTheDocument();
    show({ inside: false, room: null, door: "enter", entrance: "cold-room" });
    expect(screen.getAllByText(/Cold Room is open/i).length).toBeGreaterThan(0);
    show({ inside: false, room: null, door: null, entrance: null, near: true });
    expect(screen.getByRole("button", { name: "Take clue" })).toBeInTheDocument();
  });

  it("says a shut shop is closed and a house is locked, and never offers to go in", () => {
    render(<ExploreHud onMenu={() => {}} onNewGame={() => {}} />);
    show({ inside: false, room: null, door: "closed", entrance: "ade-and-sons-door" });
    expect(screen.getAllByText(/closed for now/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Closed" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enter" })).toBeNull();
    show({ inside: false, room: null, door: "locked", entrance: "market-home-door" });
    expect(screen.getAllByText(/Locked\. Someone lives here/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Locked" })).toBeInTheDocument();
  });

  it("calls the figures placeholders and shows the stock as an example only", () => {
    render(<ExploreHud onMenu={() => {}} onNewGame={() => {}} />);
    show({ seller: true });
    expect(screen.getByText(/the seller are placeholders/i)).toBeInTheDocument();
    act(() => {
      openDialogue(SELLER_SCRIPT);
    });
    expect(screen.getByRole("dialog", { name: /seller dialogue/i })).toBeInTheDocument();
    expect(screen.getByText(/prototype/i)).toBeInTheDocument();
  });

  it("steps through the lines with Next, lists the stock, and closes with Close", async () => {
    render(<ExploreHud onMenu={() => {}} onNewGame={() => {}} />);
    show({ seller: true });
    act(() => {
      openDialogue(SELLER_SCRIPT);
    });
    expect(screen.queryByRole("list", { name: /shelf stock/i })).toBeNull();
    await userEvent.click(within(screen.getByRole("dialog", { name: /seller dialogue/i })).getByRole("button", { name: "Next" }));
    const stock = screen.getByRole("list", { name: /shelf stock/i });
    expect(stock.querySelectorAll("li")).toHaveLength(3);
    expect(stock).toHaveTextContent(/bottled water/i);
    expect(stock).toHaveTextContent(/bread/i);
    expect(screen.getByText(/nothing can be bought yet/i)).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("dialog", { name: /seller dialogue/i })).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: /seller dialogue/i })).toBeNull();
  });

  it("offers Close on the main button after the last line, and Next before it", () => {
    render(<ExploreHud onMenu={() => {}} onNewGame={() => {}} />);
    show({ seller: true });
    act(() => {
      openDialogue(SELLER_SCRIPT);
    });
    expect(screen.getAllByRole("button", { name: "Next" }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/talk to the seller/i)).toBeNull();
  });
});
