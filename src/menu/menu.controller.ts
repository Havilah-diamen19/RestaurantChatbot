import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse,
  ApiQuery, ApiParam,
} from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { MenuCategory } from './entities/menu.entity';

@ApiTags('menu')
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @ApiOperation({ summary: 'Get all available menu items' })
  @ApiQuery({ name: 'category', enum: MenuCategory, required: false })
  @ApiResponse({ status: 200, description: 'List of menu items' })
  findAll(@Query('category') category?: MenuCategory) {
    return this.menuService.findAll(category);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single menu item by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Menu item found' })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.findOne(id);
  }
}