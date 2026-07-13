import * as fs from "fs";
import { globSync } from "glob";
import * as path from "path";
import { Plugin } from "vite";

// Ported from care_fe's plugins/treeShakeCareIcons.ts, adapted for this
// repo's layout (src/ only, no apps/ directory).

export interface TreeShakeCareIconsOptions {
  iconWhitelist: string[];
}

export function treeShakeCareIcons(
  options: TreeShakeCareIconsOptions = { iconWhitelist: [] },
): Plugin {
  const rootDir = path.resolve(__dirname, "..");
  const lineIconNameRegex = /"l-[a-z]+(?:-[a-z]+)*"/g;
  const allUniconPaths = JSON.parse(
    fs.readFileSync(
      path.resolve(rootDir, "src/CAREUI/icons/UniconPaths.json"),
      "utf8",
    ),
  );

  function extractCareIconNames(file: string): string[] {
    const fileContent = fs.readFileSync(file, "utf8");
    const lineIconNameMatches = fileContent.match(lineIconNameRegex) || [];
    return lineIconNameMatches.map((lineIconName) => lineIconName.slice(1, -1));
  }

  function getAllUsedIconNames() {
    const files = globSync(path.resolve(rootDir, "src/**/*.{tsx,ts}"));
    const usedIconsArray: string[] = [];

    files.forEach((file) => {
      usedIconsArray.push(...extractCareIconNames(file));
    });

    return new Set(usedIconsArray);
  }

  function getTreeShakenUniconPaths() {
    const usedIcons = [...getAllUsedIconNames(), ...options.iconWhitelist];
    const treeshakenCareIconPaths: { [key: string]: string } = {};

    for (const iconName of usedIcons) {
      const iconPath = allUniconPaths[iconName];
      if (iconPath === undefined) {
        throw new Error(`Icon ${iconName} is not found in UniconPaths.json`);
      }
      treeshakenCareIconPaths[iconName] = iconPath;
    }

    return treeshakenCareIconPaths;
  }

  return {
    name: "tree-shake-care-icons",
    transform(_src, id) {
      if (process.env.NODE_ENV !== "production") {
        return;
      }

      if (id.endsWith("UniconPaths.json")) {
        return {
          code: `export default ${JSON.stringify(getTreeShakenUniconPaths())}`,
          map: null,
        };
      }
    },
  };
}
