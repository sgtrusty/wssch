import inquirer from "inquirer";
import { profileService } from "@config/index.js";
import type { Profile } from "@config/profile.service.js";
import { logger } from "@lib/logger.js";

function describeProfile(p: Profile, lastUsed: string | null): string {
  const flags: string[] = [];
  if (p.isDefault) flags.push("default");
  if (lastUsed === p.id) flags.push("last used");
  const suffix = flags.length ? ` (${flags.join(", ")})` : "";
  const desc = p.description ? ` — ${p.description}` : "";
  return `${p.id}  ${p.name}${suffix}${desc}`;
}

export async function createProfileUI(): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Profile name:",
      default: "work",
      validate: (v: string) =>
        v && v.trim().length > 0 ? true : "Name is required",
    },
    {
      type: "input",
      name: "description",
      message: "Description (optional):",
      default: "",
    },
    {
      type: "confirm",
      name: "setDefault",
      message: "Set as the default profile?",
      default: false,
    },
  ]);

  const profile = profileService.createProfile(
    answers.name,
    answers.description || undefined,
  );

  if (answers.setDefault) {
    profileService.setDefault(profile.id);
  }

  logger.check(
    "profile",
    `Created profile ${profile.id} (${profile.name})`,
  );
  if (answers.setDefault) {
    logger.info("profile", `Marked ${profile.name} as default`);
  }
}

export async function manageProfilesUI(): Promise<void> {
  // Ensure the registry exists and any legacy layout is migrated.
  profileService.getRegistry();

  while (true) {
    const reg = profileService.getRegistry();
    const profiles = reg.profiles;

    const action = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Profile management",
        choices: [
          { name: "Create new profile", value: "create" },
          new inquirer.Separator(),
          ...profiles.map((p) => ({
            name: `Use now: ${describeProfile(p, reg.lastUsed)}`,
            value: `use:${p.id}`,
          })),
          ...profiles.map((p) => ({
            name: `Set default: ${describeProfile(p, reg.lastUsed)}`,
            value: `default:${p.id}`,
          })),
          ...profiles.map((p) => ({
            name: `Rename: ${describeProfile(p, reg.lastUsed)}`,
            value: `rename:${p.id}`,
          })),
          ...(profiles.length > 1
            ? profiles.map((p) => ({
                name: `Delete: ${describeProfile(p, reg.lastUsed)}`,
                value: `delete:${p.id}`,
              }))
            : []),
          new inquirer.Separator(),
          { name: "Exit", value: "exit" },
        ],
      },
    ]);

    const value = action.action as string;

    if (value === "exit") {
      return;
    }

    if (value === "create") {
      await createProfileUI();
      continue;
    }

    const [verb, id] = value.split(":", 2);

    switch (verb) {
      case "use": {
        profileService.setLastUsed(id);
        const p = profileService.getProfile(id);
        logger.check("profile", `Active profile set to ${p?.name ?? id}`);
        break;
      }
      case "default": {
        profileService.setDefault(id);
        const p = profileService.getProfile(id);
        logger.check("profile", `Default profile set to ${p?.name ?? id}`);
        break;
      }
      case "rename": {
        const p = profileService.getProfile(id);
        if (!p) break;
        const ans = await inquirer.prompt([
          {
            type: "input",
            name: "name",
            message: `New name for profile ${p.id}:`,
            default: p.name,
            validate: (v: string) =>
              v && v.trim().length > 0 ? true : "Name is required",
          },
        ]);
        if (profileService.renameProfile(id, ans.name)) {
          logger.check("profile", `Renamed profile ${id} to ${ans.name}`);
        }
        break;
      }
      case "delete": {
        const p = profileService.getProfile(id);
        if (!p) break;
        const confirm = await inquirer.prompt([
          {
            type: "confirm",
            name: "ok",
            message: `Delete profile ${p.id} (${p.name}) and all its data?`,
            default: false,
          },
        ]);
        if (confirm.ok && profileService.deleteProfile(id)) {
          logger.check("profile", `Deleted profile ${id}`);
        }
        break;
      }
      default:
        break;
    }
  }
}

export async function profileCommandUI(): Promise<void> {
  await manageProfilesUI();
}
