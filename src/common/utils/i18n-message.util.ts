import { i18nValidationMessage, type Path } from "nestjs-i18n";
import type { I18nTranslations } from "@/generated/i18n.generated";

type I18nArgs = Parameters<typeof i18nValidationMessage>[1];

export function i18nMsg(key: Path<I18nTranslations>, args?: I18nArgs) {
  return i18nValidationMessage<I18nTranslations>(key, args);
}
