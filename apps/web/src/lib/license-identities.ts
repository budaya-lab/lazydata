export function createLicenseIdentities(names: string[]) {
  let entries = names.map((name, id) => ({ name, id }));
  let next = 200;
  return {
    update(names: string[], removedIndex?: number): number[] {
      const remaining = entries.filter((_, index) => index !== removedIndex);
      entries = names.map((name) => {
        const index = remaining.findIndex((entry) => entry.name === name);
        return index < 0 ? { name, id: next++ } : remaining.splice(index, 1)[0];
      });
      return entries.map((entry) => entry.id);
    },
  };
}
