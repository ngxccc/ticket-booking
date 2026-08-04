import { applyDecorators } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty } from "class-validator";
import { i18nMsg } from "@/common/utils/i18n-message.util";

export function TransformEnum(enumValues: readonly string[]) {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => {
      if (typeof value !== "string") return value;
      const canonical = enumValues.find(
        (enumValue) => enumValue.toLowerCase() === value.toLowerCase(),
      );
      return canonical ?? value;
    }),
    IsIn(enumValues as readonly unknown[], {
      message: i18nMsg("validation.isIn"),
    }),
    IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") }),
  );
}
