import { applyDecorators } from "@nestjs/common";
import type { Type } from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiProperty,
  getSchemaPath,
} from "@nestjs/swagger";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export class ApiResponseDto<T> {
  @ApiProperty({ example: true })
  success!: boolean;

  data!: T;
}

const createApiResponseGeneric = (
  responseDecorator: typeof ApiOkResponse,
  model?: Type,
) => {
  if (!model) {
    return applyDecorators(
      ApiExtraModels(ApiResponseDto),
      responseDecorator({
        schema: {
          allOf: [
            { $ref: getSchemaPath(ApiResponseDto) },
            {
              properties: {
                data: {
                  type: "object",
                  nullable: true,
                  default: null,
                },
              },
            },
          ],
        },
      }),
    );
  }

  return applyDecorators(
    ApiExtraModels(ApiResponseDto, model),
    responseDecorator({
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          {
            properties: {
              data: {
                $ref: getSchemaPath(model),
              },
            },
          },
        ],
      },
    }),
  );
};

export const ApiOkResponseGeneric = (model?: Type) =>
  createApiResponseGeneric(ApiOkResponse, model);

export const ApiCreatedResponseGeneric = (model?: Type) =>
  createApiResponseGeneric(ApiCreatedResponse, model);
