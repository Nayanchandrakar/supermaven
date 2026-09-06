import type { AstService } from "@/services/ast-service";
import type { NearbyContext } from "@/types";
import { extractDeclaredNames } from "@/utils/ast-analysis";
import {
  findImportLineSpans,
  parseImportBindings,
  removeLineSpans,
} from "@/utils/import-analysis";
import { extractIdentifiers } from "@/utils/language";

export class ReferenceExtractor {
  private readonly astService: AstService;

  constructor(astService: AstService) {
    this.astService = astService;
  }

  extract(prefix: string, languageId: string): NearbyContext {
    const { importedAliasesByOriginal } = parseImportBindings(
      prefix,
      languageId
    );
    const importSpans = findImportLineSpans(prefix, languageId);
    const prefixWithoutImports = removeLineSpans(prefix, importSpans);

    const lines = prefixWithoutImports.split("\n");
    const nearbyText = lines.slice(-15).join("\n");
    const nearbyIdentifiers = extractIdentifiers(nearbyText, languageId);

    const declaredIdentifiers =
      this.astService.withParsedTree(prefix, extractDeclaredNames) ??
      new Set<string>();

    const referenceNames = ReferenceExtractor.buildReferenceNames(
      nearbyIdentifiers,
      importedAliasesByOriginal,
      declaredIdentifiers
    );

    return {
      declaredIdentifiers,
      nearbyIdentifiers,
      referenceNames,
    };
  }

  private static buildReferenceNames(
    nearbyIdentifiers: Set<string>,
    aliasesByOriginal: Map<string, Set<string>>,
    declaredIdentifiers: Set<string>
  ): Set<string> {
    const references = new Set<string>();
    const originalByAlias = new Map<string, string>();

    for (const [original, aliases] of aliasesByOriginal) {
      for (const alias of aliases) {
        originalByAlias.set(alias, original);
      }
    }

    for (const identifier of nearbyIdentifiers) {
      if (declaredIdentifiers.has(identifier)) {
        continue;
      }

      const original = originalByAlias.get(identifier) ?? identifier;
      references.add(original);
    }

    return references;
  }
}
