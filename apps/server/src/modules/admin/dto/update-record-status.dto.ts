import { IsIn } from "class-validator";

export class UpdateRecordStatusDto {
  @IsIn(["ACTIVE", "INACTIVE"])
  status!: "ACTIVE" | "INACTIVE";
}
