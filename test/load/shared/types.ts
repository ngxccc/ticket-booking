export interface TestUserFixture {
  id: string;
  email: string;
  token: string;
  ip: string;
}

export interface BookingLoadFixture {
  targetUrl: string;
  showId: string;
  targetSeatId: string;
  otherSeatIds: string[];
  totalVus: number;
  users: TestUserFixture[];
}

export interface ShowsSeatsLoadFixture {
  targetUrl: string;
  standardShowId: string;
  imaxShowId: string;
  standardTotalSeats: number;
  imaxTotalSeats: number;
  hotShowIds: string[];
  catalogShowIds: string[];
  allShowIds: string[];
}
