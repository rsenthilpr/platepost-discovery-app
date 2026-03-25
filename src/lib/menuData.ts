export interface MenuItem {
  id: string
  name: string
  description: string
  price: string
  popular?: boolean
  pexelsQuery: string
  photoUrl?: string
  videoUrl?: string
}

export interface MenuCategory {
  name: string
  items: MenuItem[]
}

function item(
  id: string,
  name: string,
  description: string,
  price: string,
  popular = false,
  pexelsQuery = ''
): MenuItem {
  return { id, name, description, price, popular, pexelsQuery: pexelsQuery || name }
}

const MENUS: Record<string, MenuCategory[]> = {
  Coffee: [
    {
      name: 'Hot Drinks',
      items: [
        item('c1', 'Cappuccino', 'Espresso with steamed milk foam, dusted with cocoa', '$4.99', true, 'cappuccino coffee'),
        item('c2', 'Latte', 'Smooth espresso with silky steamed whole milk', '$5.49', false, 'latte coffee'),
        item('c3', 'Vanilla Latte', 'Espresso with house-made vanilla syrup and steamed milk', '$5.99', true, 'vanilla latte'),
        item('c4', 'Matcha Latte', 'Ceremonial grade matcha whisked with oat milk', '$5.99', false, 'matcha latte'),
      ],
    },
    {
      name: 'Cold Drinks',
      items: [
        item('c5', 'Cold Brew', '20-hour slow-steeped cold brew, served over ice', '$4.99', true, 'cold brew coffee'),
      ],
    },
    {
      name: 'Food',
      items: [
        item('c6', 'Croissant', 'Buttery, flaky French pastry baked fresh daily', '$3.99', false, 'croissant pastry'),
        item('c7', 'Avocado Toast', 'Smashed avocado on sourdough with chili flakes and lemon', '$8.99', true, 'avocado toast'),
        item('c8', 'Banana Bread', 'Moist house-baked banana bread with walnut crumble', '$3.49', false, 'banana bread'),
      ],
    },
  ],
  Cafe: [
    {
      name: 'Hot Drinks',
      items: [
        item('ca1', 'Cappuccino', 'Espresso with steamed milk foam, dusted with cocoa', '$4.99', true, 'cappuccino coffee'),
        item('ca2', 'Latte', 'Smooth espresso with silky steamed whole milk', '$5.49', false, 'latte coffee'),
        item('ca3', 'Vanilla Latte', 'Espresso with house-made vanilla syrup and steamed milk', '$5.99', true, 'vanilla latte'),
        item('ca4', 'Matcha Latte', 'Ceremonial grade matcha whisked with oat milk', '$5.99', false, 'matcha latte'),
      ],
    },
    {
      name: 'Cold Drinks',
      items: [
        item('ca5', 'Cold Brew', '20-hour slow-steeped cold brew, served over ice', '$4.99', true, 'cold brew coffee'),
      ],
    },
    {
      name: 'Food',
      items: [
        item('ca6', 'Croissant', 'Buttery, flaky French pastry baked fresh daily', '$3.99', false, 'croissant pastry'),
        item('ca7', 'Avocado Toast', 'Smashed avocado on sourdough with chili flakes and lemon', '$8.99', true, 'avocado toast'),
        item('ca8', 'Banana Bread', 'Moist house-baked banana bread with walnut crumble', '$3.49', false, 'banana bread'),
      ],
    },
  ],
  Japanese: [
    {
      name: 'Rolls',
      items: [
        item('j1', 'Salmon Roll', 'Fresh Atlantic salmon with cucumber and avocado', '$14.99', true, 'salmon sushi roll'),
        item('j2', 'Tuna Sashimi', 'Premium bluefin tuna sliced to order', '$16.99', true, 'tuna sashimi'),
      ],
    },
    {
      name: 'Mains',
      items: [
        item('j3', 'Ramen', 'Rich tonkotsu broth, chashu pork, soft-boiled egg, nori', '$15.99', true, 'ramen bowl'),
        item('j4', 'Tempura', 'Lightly battered shrimp and vegetables with tentsuyu', '$13.99', false, 'tempura shrimp'),
      ],
    },
    {
      name: 'Starters',
      items: [
        item('j5', 'Edamame', 'Steamed salted soybeans with sea salt flakes', '$5.99', false, 'edamame soybeans'),
        item('j6', 'Miso Soup', 'Traditional dashi broth with tofu and wakame', '$3.99', false, 'miso soup'),
        item('j7', 'Gyoza', 'Pan-fried pork and cabbage dumplings with ponzu', '$8.99', true, 'gyoza dumplings'),
      ],
    },
    {
      name: 'Desserts',
      items: [
        item('j8', 'Matcha Ice Cream', 'House-churned ceremonial matcha soft serve', '$6.99', false, 'matcha ice cream'),
      ],
    },
  ],
  Italian: [
    {
      name: 'Pizza',
      items: [
        item('i1', 'Margherita Pizza', 'San Marzano tomato, fresh fior di latte, basil', '$16.99', true, 'margherita pizza'),
      ],
    },
    {
      name: 'Pasta',
      items: [
        item('i2', 'Pasta Carbonara', 'Guanciale, Pecorino Romano, egg yolk, black pepper', '$17.99', true, 'pasta carbonara'),
        item('i3', 'Risotto', 'Arborio rice, saffron, Parmigiano-Reggiano, white wine', '$18.99', false, 'risotto dish'),
        item('i4', 'Lasagna', 'Slow-braised Bolognese, béchamel, house pasta sheets', '$16.99', false, 'lasagna italian'),
      ],
    },
    {
      name: 'Starters',
      items: [
        item('i5', 'Bruschetta', 'Grilled sourdough, heirloom tomato, fresh basil, EVOO', '$8.99', true, 'bruschetta italian'),
        item('i6', 'Caesar Salad', 'Romaine, anchovy dressing, house croutons, Parmigiano', '$12.99', false, 'caesar salad'),
      ],
    },
    {
      name: 'Desserts',
      items: [
        item('i7', 'Tiramisu', 'Espresso-soaked ladyfingers, mascarpone, cocoa dust', '$7.99', true, 'tiramisu dessert'),
        item('i8', 'Gelato', 'House-churned seasonal flavors — ask your server', '$5.99', false, 'gelato italian'),
      ],
    },
  ],
  American: [
    {
      name: 'Mains',
      items: [
        item('a1', 'Classic Burger', 'Dry-aged beef patty, aged cheddar, lettuce, house sauce', '$14.99', true, 'classic burger'),
        item('a2', 'BBQ Ribs', 'Slow-smoked pork ribs, house BBQ glaze, coleslaw', '$22.99', true, 'bbq ribs'),
        item('a3', 'Mac and Cheese', 'Three-cheese blend, toasted breadcrumbs, truffle oil', '$11.99', false, 'mac and cheese'),
      ],
    },
    {
      name: 'Starters',
      items: [
        item('a4', 'Buffalo Wings', 'Crispy wings, house buffalo sauce, blue cheese dip', '$13.99', true, 'buffalo wings'),
        item('a5', 'Caesar Salad', 'Romaine, anchovy dressing, house croutons, Parmigiano', '$12.99', false, 'caesar salad'),
        item('a6', 'Onion Rings', 'Beer-battered onion rings, chipotle mayo', '$7.99', false, 'onion rings'),
      ],
    },
    {
      name: 'Drinks',
      items: [
        item('a7', 'Craft Beer', 'Rotating selection of local draft beers — ask server', '$6.99', false, 'craft beer'),
      ],
    },
    {
      name: 'Desserts',
      items: [
        item('a8', 'Brownie Sundae', 'Warm fudge brownie, vanilla bean ice cream, caramel', '$8.99', true, 'brownie sundae'),
      ],
    },
  ],
  Music: [
    {
      name: 'Cocktails',
      items: [
        item('m1', 'Mojito', 'White rum, fresh lime, mint, soda water, raw sugar', '$12.99', true, 'mojito cocktail'),
        item('m2', 'Old Fashioned', 'Bourbon, Angostura bitters, sugar, orange peel', '$13.99', true, 'old fashioned cocktail'),
      ],
    },
    {
      name: 'Drinks',
      items: [
        item('m3', 'Craft Beer', 'Rotating local taps — ask your bartender', '$7.99', false, 'craft beer glass'),
        item('m4', 'House Wine', 'Red or white — ask for tonight\'s selection', '$9.99', false, 'wine glass'),
      ],
    },
    {
      name: 'Food',
      items: [
        item('m5', 'Nachos', 'Tortilla chips, queso, jalapeño, guacamole, pico', '$11.99', true, 'nachos chips'),
        item('m6', 'Sliders', 'Mini wagyu beef sliders, pickles, house sauce, brioche', '$13.99', false, 'sliders burgers'),
        item('m7', 'Cheese Board', 'Artisan selection of three cheeses, crackers, fruit', '$16.99', false, 'cheese board'),
        item('m8', 'Bruschetta', 'Grilled sourdough, heirloom tomato, basil, EVOO', '$9.99', false, 'bruschetta'),
      ],
    },
  ],
  Jazz: [
    {
      name: 'Wine & Spirits',
      items: [
        item('jz1', 'Red Wine', 'Curated selection — ask sommelier for tonight\'s pick', '$12.99', true, 'red wine glass'),
        item('jz2', 'Whiskey Sour', 'Single malt Scotch, fresh lemon, egg white foam', '$13.99', true, 'whiskey sour cocktail'),
        item('jz3', 'Champagne', 'Brut NV on ice, perfect for celebrations', '$14.99', false, 'champagne glass'),
      ],
    },
    {
      name: 'Small Plates',
      items: [
        item('jz4', 'Cheese Board', 'Triple crème brie, aged gouda, bleu, honeycomb, figs', '$18.99', true, 'cheese board'),
        item('jz5', 'Bruschetta', 'Heirloom tomato, fresh basil, aged balsamic reduction', '$10.99', false, 'bruschetta'),
        item('jz6', 'Charcuterie', 'Prosciutto, salami, cornichons, whole grain mustard', '$22.99', true, 'charcuterie board'),
      ],
    },
    {
      name: 'Desserts',
      items: [
        item('jz7', 'Chocolate Fondue', 'Belgian dark chocolate, seasonal dipping fruits', '$16.99', false, 'chocolate fondue'),
        item('jz8', 'Crème Brûlée', 'Classic vanilla custard, caramelised sugar crust', '$9.99', true, 'creme brulee'),
      ],
    },
  ],
}

export function getMenuData(cuisine: string): MenuCategory[] {
  return MENUS[cuisine] ?? MENUS['American']
}

export function getHeroVideoQuery(cuisine: string): string {
  const queries: Record<string, string> = {
    Coffee: 'coffee shop barista brewing',
    Cafe: 'coffee shop barista brewing',
    Japanese: 'japanese sushi chef preparing',
    Italian: 'italian pasta cooking kitchen',
    American: 'american burger grill cooking',
    Music: 'nightclub bar cocktail mixing',
    Jazz: 'jazz bar restaurant ambiance',
  }
  return queries[cuisine] ?? 'restaurant kitchen cooking'
}
