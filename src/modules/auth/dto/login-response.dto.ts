export class UserInfoDto {
  id!: string;
  email!: string;
  fullName!: string;
  role!: string;
}

export class LoginResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: UserInfoDto;
}
