import { AdminService } from "../src/modules/admin/admin.service";

describe("Admin room pagination and extensible hotel messages", () => {
  it("returns hotel-filtered rooms in fixed pages of 20", async () => {
    const count = jest.fn().mockResolvedValue(45);
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new AdminService({ room: { count, findMany } } as never);

    await expect(service.listRooms("hotel-id", 2)).resolves.toEqual({
      items: [], total: 45, page: 2, pageSize: 20, totalPages: 3,
    });
    expect(count).toHaveBeenCalledWith({ where: { hotelId: "hotel-id" } });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20, where: { hotelId: "hotel-id" } }));
  });

  it("upserts a message by hotel and arbitrary valid language code", async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: "hotel-id" });
    const upsert = jest.fn().mockResolvedValue({});
    const findUniqueOrThrow = jest.fn().mockResolvedValue({ id: "hotel-id", welcomeMessages: [{ language: "fr", message: "Bienvenue" }] });
    const service = new AdminService({
      hotel: { findUnique, findUniqueOrThrow },
      hotelWelcomeMessage: { upsert },
    } as never);

    await service.updateHotelWelcomeMessage("hotel-id", { language: "fr", welcomeMessage: " Bienvenue " });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { hotelId_language: { hotelId: "hotel-id", language: "fr" } },
      update: { message: "Bienvenue" },
    }));
  });
});
