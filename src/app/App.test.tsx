import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { CLUE_STORAGE_KEY, resetQuest } from "../game/explore/quest";
import { App } from "./App";

afterEach(() => {
  resetQuest();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("App main menu", () => {
  it("shows the Naija Hunt identity, Palm Mile, and a preview status", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: /naija hunt/i })).toBeInTheDocument();
    expect(screen.getByText(/^palm mile$/i)).toBeInTheDocument();
    expect(screen.getByText(/fictional district · visual preview/i)).toBeInTheDocument();
  });

  it("describes the 3D district and falls back when WebGL is unavailable", () => {
    render(<App />);

    expect(
      screen.getByRole("region", { name: /live 3d preview of palm mile, a fictional lagos-inspired district/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/3d preview unavailable on this device/i)).toBeInTheDocument();
    expect(document.querySelector("canvas")).toBeNull();
  });

  it("presents the Palm Mile cache as the walk's objective", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /palm mile cache/i })).toBeInTheDocument();
    expect(screen.getByText(/gold marker stands on palm plaza/i)).toBeInTheDocument();
  });

  it("offers Enter district as the start of the walk", () => {
    render(<App />);

    const button = screen.getByRole("button", { name: /enter district/i });
    expect(button).toBeEnabled();
    expect(button).toHaveAccessibleDescription(/starts the walk through palm mile/i);
  });

  it("starts the walk from Enter district and can return to the menu", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /enter district/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/find the gold marker on palm plaza/i);
    expect(screen.queryByRole("button", { name: /enter district/i })).not.toBeInTheDocument();
    expect(window.location.search).toContain("play=1");

    await user.click(screen.getByRole("button", { name: /^menu$/i }));

    expect(screen.getByRole("button", { name: /enter district/i })).toBeInTheDocument();
    expect(window.location.search).not.toContain("play=1");
  });

  it("opens a direct play link and keeps a collected clue across a new render", async () => {
    localStorage.setItem(CLUE_STORAGE_KEY, "1");
    window.history.replaceState({}, "", "/?play=1");
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent(/palm mile marker is yours/i);

    await user.click(screen.getByRole("button", { name: /new game/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/find the gold marker on palm plaza/i);
    expect(localStorage.getItem(CLUE_STORAGE_KEY)).toBeNull();
  });

  it("opens honest prototype panels for map, inventory, and character", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /^map$/i }));
    expect(screen.getByRole("dialog", { name: /map/i })).toHaveTextContent(/not built yet/i);
    await user.click(screen.getByRole("button", { name: /close/i }));

    const inventoryButtons = screen.getAllByRole("button", { name: /^inventory$/i });
    const inventoryButton = inventoryButtons[0];
    if (!inventoryButton) {
      throw new Error("Inventory shortcut was not rendered.");
    }
    await user.click(inventoryButton);
    expect(screen.getByRole("dialog", { name: /inventory/i })).toHaveTextContent(/nothing is stored/i);
    await user.click(screen.getByRole("button", { name: /close/i }));

    await user.click(screen.getByRole("button", { name: /^character$/i }));
    expect(screen.getByRole("dialog", { name: /character/i })).toHaveTextContent(/protagonist is not in this build/i);
    expect(screen.getByRole("dialog", { name: /character/i })).toHaveTextContent(/temporary placeholder/i);
  });

  it("lists future systems on the profile panel and does not mention real-money features", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /^profile$/i }));
    const profile = screen.getByRole("dialog", { name: /profile/i });
    for (const feature of ["Crews", "Chat", "Heists", "Multiplayer"]) {
      expect(profile).toHaveTextContent(feature);
    }
    expect(profile).toHaveTextContent(/none of these exist yet/i);
    expect(document.body).not.toHaveTextContent(/cash|crypto|withdraw|deposit/i);
  });
});
