import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";
import { HotelLogosController } from "./hotel-logos.controller";

@Module({ imports: [AuthModule], controllers: [RoomsController, HotelLogosController], providers: [RoomsService] })
export class RoomsModule {}
