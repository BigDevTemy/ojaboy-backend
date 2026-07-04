import { ProductCategoriesService } from './product-categories.service';

describe('ProductCategoriesService', () => {
  it('creates a category with a generated slug', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'category-id',
      name: 'Fresh Produce',
      slug: 'fresh-produce',
    });
    const service = new ProductCategoriesService({
      productCategory: { create },
    } as never);

    await service.create({ name: ' Fresh Produce ', sortOrder: 10 });

    expect(create).toHaveBeenCalledWith({
      data: {
        name: 'Fresh Produce',
        slug: 'fresh-produce',
        description: undefined,
        imageUrl: undefined,
        sortOrder: 10,
      },
    });
  });

  it('lists all categories when no active filter is supplied', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ProductCategoriesService({
      productCategory: { findMany },
    } as never);

    await service.findAll();

    expect(findMany).toHaveBeenCalledWith({
      where: undefined,
      include: { _count: { select: { products: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  });

  it('filters categories by active status when requested', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ProductCategoriesService({
      productCategory: { findMany },
    } as never);

    await service.findAll(true);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it('deactivates a category without deleting its products', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'category-id' });
    const service = new ProductCategoriesService({
      productCategory: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'category-id',
        }),
        update,
      },
    } as never);

    await service.deactivate('category-id');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'category-id' },
      data: { isActive: false },
    });
  });
});
