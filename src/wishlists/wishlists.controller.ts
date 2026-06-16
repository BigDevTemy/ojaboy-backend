import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { ConvertWishlistDto } from './dto/convert-wishlist.dto';
import { CreateWishlistDto } from './dto/create-wishlist.dto';
import { QuoteWishlistDto } from './dto/quote-wishlist.dto';
import { UpdateWishlistItemDto } from './dto/update-wishlist-item.dto';
import { WishlistItemDto } from './dto/wishlist-item.dto';
import { WishlistsService } from './wishlists.service';

@Controller('wishlists')
@UseGuards(JwtAuthGuard)
export class WishlistsController {
  constructor(private readonly wishlistsService: WishlistsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWishlistDto) {
    return this.wishlistsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.wishlistsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wishlistsService.findOne(user.id, id);
  }

  @Post(':id/items')
  addItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: WishlistItemDto,
  ) {
    return this.wishlistsService.addItem(user.id, id, dto);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateWishlistItemDto,
  ) {
    return this.wishlistsService.updateItem(user.id, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.wishlistsService.removeItem(user.id, id, itemId);
  }

  @Post(':id/quote')
  quote(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: QuoteWishlistDto,
  ) {
    return this.wishlistsService.quote(user, id, dto);
  }

  @Post(':id/convert')
  convert(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ConvertWishlistDto,
  ) {
    return this.wishlistsService.convert(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wishlistsService.remove(user.id, id);
  }
}
