

// 1. Core Exercise Day Library
export const PROGRAMS = {
  "Push Day": [
    "Chest Press", "Incline Dumbbell Press", "Overhead Press", 
    "Dumbbell Lateral Raise", "Cable Fly", "Chest Dip", 
    "Triceps Pushdown", "Skull Crushers", "Push-Up", "Machine Chest Press"
  ],
  "Pull Day": [
    "Pull-Up", "Lat Pulldown", "Barbell Row", "Seated Cable Row", 
    "Face Pull", "Dumbbell Curl", "Hammer Curl", "Rear Delt Fly", 
    "Chest-Supported Row", "Straight-Arm Pulldown"
  ],
  "Leg Day": [
    "Back Squat", "Front Squat", "Romanian Deadlift", "Leg Press", 
    "Walking Lunge", "Leg Extension", "Leg Curl", "Calf Raise", 
    "Hip Thrust", "Bulgarian Split Squat"
  ],
  "Upper Body Day": [
    "Bench Press", "Pull-Up", "Overhead Press", "Barbell Row", 
    "Incline Dumbbell Press", "Seated Cable Row", "Lateral Raise", 
    "Triceps Extension", "Biceps Curl", "Face Pull"
  ],
  "Lower Body Day": [
    "Back Squat", "Deadlift", "Leg Press", "Romanian Deadlift", 
    "Walking Lunge", "Leg Extension", "Leg Curl", "Calf Raise", 
    "Hip Thrust", "Bulgarian Split Squat"
  ],
  "Total Body Day": [
    "Deadlift", "Front Squat", "Bench Press", "Pull-Up", 
    "Overhead Press", "Barbell Row", "Kettlebell Swing", 
    "Farmer Carry", "Push Press", "Goblet Squat"
  ],
  "Calisthenics": [
    "Push-Up", "Pull-Up", "Dip", "Bodyweight Squat", 
    "Walking Lunge", "Plank", "Hollow Hold", "Inverted Row", 
    "Pike Push-Up", "Mountain Climber"
  ],
  "Chest-Biceps Day": [
    "Chest Press", "Incline Chest Press", "Chest Fly", "DB Chest Press", 
    "Overhead Press", "Cable Curls", "DB Curls", 
    "DB Hammer Curls", "Barbell Curls"
  ],
  "Back-Triceps Day": [
    "Bent Over Row", "Lat Pulldown", "Back Row", "DB Row", 
    "Rear Delt Fly", "Tricep Press Down", "OH Tricep Press", 
    "DB Tricep Kickbacks", "Tricep Dips"
  ],
  "Leg-Quad-Dom Day": [
    "Squat", "Leg Press", "Hack Squat", "Lunges", 
    "Leg Extensions", "Hip Abductor"
  ],
  "Leg-Ham-Dom Day": [
    "Stiff Leg Deadlift", "Dead Lift", "Seated Leg Curl", "Prone Leg Curl", 
    "Step Ups", "Hip Adductor", "Wide leg far leg press"
  ]
};

// 2. Parent-to-Child Mapping Matrix (Cardio is removed to run as a separate form)
export const ROUTINES = {
  "Push Pull Legs": ["Push Day", "Pull Day", "Leg Day"],
  "Upper Lower Body": ["Upper Body Day", "Lower Body Day"],
  "Bro Split": ["Chest-Biceps Day", "Back-Triceps Day", "Leg-Quad-Dom Day", "Leg-Ham-Dom Day"],
  "Total Body & Calisthenics": ["Total Body Day", "Calisthenics"]
};