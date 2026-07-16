export type RecipeSeed = {
  id: string;
  title: string;
  titleEl: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  dietaryTags: readonly string[];
  allergenTags: readonly string[];
  instructions: readonly string[];
  instructionsEl: readonly string[];
  ingredients: readonly { foodName: string; grams: number }[];
};

const make = (
  sequence: number,
  title: string,
  titleEl: string,
  ingredients: readonly [foodName: string, grams: number][],
  dietaryTags: readonly string[],
  allergenTags: readonly string[] = [],
  cookMinutes = 20,
): RecipeSeed => ({
  id: `seed-recipe-${String(sequence).padStart(3, '0')}`,
  title,
  titleEl,
  servings: 2,
  prepMinutes: 10,
  cookMinutes,
  dietaryTags,
  allergenTags,
  instructions: ['Prepare the ingredients.', 'Cook gently until ready.', 'Divide and serve.'],
  instructionsEl: [
    'Ετοίμασε τα υλικά.',
    'Μαγείρεψε σε ήπια φωτιά μέχρι να είναι έτοιμα.',
    'Μοίρασε σε μερίδες και σέρβιρε.',
  ],
  ingredients: ingredients.map(([foodName, grams]) => ({ foodName, grams })),
});

export const productionRecipeSeeds: readonly RecipeSeed[] = [
  make(
    1,
    'Lentil and tomato bowl',
    'Μπολ φακής με ντομάτα',
    [
      ['Cooked lentils', 400],
      ['Tomato', 180],
      ['Onion', 60],
    ],
    ['vegan', 'mediterranean'],
  ),
  make(
    2,
    'Chickpea cucumber salad',
    'Σαλάτα ρεβιθιού με αγγούρι',
    [
      ['Cooked chickpeas', 360],
      ['Cucumber', 220],
      ['Tomato', 160],
    ],
    ['vegan', 'mediterranean'],
  ),
  make(
    3,
    'White bean garden bowl',
    'Μπολ λευκών φασολιών',
    [
      ['Cooked white beans', 360],
      ['Green pepper', 120],
      ['Onion', 50],
    ],
    ['vegan', 'mediterranean'],
  ),
  make(
    4,
    'Warm black-eyed pea salad',
    'Ζεστή σαλάτα με μαυρομάτικα',
    [
      ['Black-eyed peas', 360],
      ['Spinach', 160],
      ['Carrot', 100],
    ],
    ['vegan', 'mediterranean'],
  ),
  make(
    5,
    'Fava with roasted vegetables',
    'Φάβα με ψητά λαχανικά',
    [
      ['Split pea purée', 360],
      ['Red pepper', 160],
      ['Onion', 70],
    ],
    ['vegan', 'mediterranean'],
  ),
  make(
    6,
    'Vegetable rice skillet',
    'Ρύζι με λαχανικά',
    [
      ['Cooked brown rice', 360],
      ['Zucchini', 180],
      ['Mushrooms', 140],
    ],
    ['vegan'],
  ),
  make(
    7,
    'Quinoa spinach bowl',
    'Μπολ κινόα με σπανάκι',
    [
      ['Cooked quinoa', 340],
      ['Spinach', 180],
      ['Red pepper', 120],
    ],
    ['vegan', 'gluten_free'],
  ),
  make(
    8,
    'Bulgur tomato pilaf',
    'Πλιγούρι πιλάφι με ντομάτα',
    [
      ['Cooked bulgur', 360],
      ['Tomato', 220],
      ['Green pepper', 100],
    ],
    ['vegan'],
  ),
  make(
    9,
    'Broccoli whole-wheat pasta',
    'Ζυμαρικά ολικής με μπρόκολο',
    [
      ['Whole-wheat pasta', 360],
      ['Broccoli', 240],
      ['Mushrooms', 120],
    ],
    ['vegan'],
  ),
  make(
    10,
    'Eggplant chickpea stew',
    'Μελιτζάνα με ρεβίθια',
    [
      ['Eggplant', 300],
      ['Cooked chickpeas', 300],
      ['Tomato', 220],
    ],
    ['vegan', 'mediterranean'],
    [],
    35,
  ),
  make(
    11,
    'Chicken brown rice plate',
    'Κοτόπουλο με καστανό ρύζι',
    [
      ['Chicken breast grilled', 300],
      ['Cooked brown rice', 320],
      ['Broccoli', 180],
    ],
    ['high_protein', 'gluten_free'],
  ),
  make(
    12,
    'Chicken quinoa salad',
    'Σαλάτα κινόα με κοτόπουλο',
    [
      ['Chicken breast grilled', 260],
      ['Cooked quinoa', 300],
      ['Cucumber', 160],
    ],
    ['high_protein', 'gluten_free'],
  ),
  make(
    13,
    'Turkey sweet potato bowl',
    'Μπολ γαλοπούλας με γλυκοπατάτα',
    [
      ['Turkey breast roasted', 280],
      ['Baked sweet potato', 360],
      ['Spinach', 140],
    ],
    ['high_protein', 'gluten_free'],
  ),
  make(
    14,
    'Beef and vegetable rice',
    'Ρύζι με μοσχάρι και λαχανικά',
    [
      ['Lean beef grilled', 280],
      ['Cooked white rice', 340],
      ['Green pepper', 140],
    ],
    ['high_protein', 'gluten_free'],
  ),
  make(
    15,
    'Lemon pork with potatoes',
    'Χοιρινό λεμονάτο με πατάτες',
    [
      ['Pork loin grilled', 300],
      ['Boiled potato', 420],
      ['Carrot', 120],
    ],
    ['high_protein', 'gluten_free'],
  ),
  make(
    16,
    'Sea bream vegetable plate',
    'Τσιπούρα με λαχανικά',
    [
      ['Sea bream grilled', 320],
      ['Zucchini', 220],
      ['Boiled potato', 300],
    ],
    ['pescatarian', 'gluten_free'],
    ['fish'],
  ),
  make(
    17,
    'Salmon quinoa bowl',
    'Μπολ σολομού με κινόα',
    [
      ['Salmon grilled', 280],
      ['Cooked quinoa', 300],
      ['Broccoli', 180],
    ],
    ['pescatarian', 'gluten_free'],
    ['fish'],
  ),
  make(
    18,
    'Tuna white bean salad',
    'Σαλάτα τόνου με λευκά φασόλια',
    [
      ['Tuna in water', 240],
      ['Cooked white beans', 300],
      ['Tomato', 180],
    ],
    ['pescatarian', 'gluten_free'],
    ['fish'],
  ),
  make(
    19,
    'Shrimp brown rice bowl',
    'Μπολ γαρίδας με καστανό ρύζι',
    [
      ['Shrimp boiled', 280],
      ['Cooked brown rice', 340],
      ['Red pepper', 140],
    ],
    ['pescatarian', 'gluten_free'],
    ['shellfish'],
  ),
  make(
    20,
    'Octopus potato salad',
    'Χταπόδι σαλάτα με πατάτα',
    [
      ['Octopus boiled', 280],
      ['Boiled potato', 360],
      ['Green pepper', 120],
    ],
    ['pescatarian', 'gluten_free'],
    ['shellfish'],
  ),
  make(
    21,
    'Yogurt oat breakfast',
    'Πρωινό γιαουρτιού με βρώμη',
    [
      ['Greek yogurt 2%', 400],
      ['Oat flakes', 100],
      ['Banana', 180],
    ],
    ['vegetarian'],
    ['dairy', 'gluten'],
  ),
  make(
    22,
    'Apple walnut yogurt',
    'Γιαούρτι με μήλο και καρύδι',
    [
      ['Greek yogurt 2%', 400],
      ['Apple', 220],
      ['Walnuts', 40],
    ],
    ['vegetarian', 'gluten_free'],
    ['dairy', 'nuts'],
  ),
  make(
    23,
    'Egg spinach toast',
    'Ψωμί με αυγό και σπανάκι',
    [
      ['Boiled egg', 200],
      ['Whole-wheat bread', 140],
      ['Spinach', 120],
    ],
    ['vegetarian', 'high_protein'],
    ['egg', 'gluten'],
  ),
  make(
    24,
    'Dakos-inspired tomato plate',
    'Πιάτο εμπνευσμένο από ντάκο',
    [
      ['Barley rusk', 160],
      ['Tomato', 260],
      ['Feta cheese', 100],
    ],
    ['vegetarian', 'mediterranean'],
    ['dairy', 'gluten'],
  ),
  make(
    25,
    'Tahini banana oats',
    'Βρώμη με ταχίνι και μπανάνα',
    [
      ['Oat flakes', 140],
      ['Banana', 220],
      ['Tahini', 50],
    ],
    ['vegan'],
    ['sesame', 'gluten'],
  ),
];
