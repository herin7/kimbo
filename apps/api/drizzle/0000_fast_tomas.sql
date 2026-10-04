CREATE TYPE "public"."activity_level" AS ENUM('sedentary', 'light', 'moderate', 'very_active');--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('lose', 'maintain', 'gain');--> statement-breakpoint
CREATE TYPE "public"."meal_source" AS ENUM('voice', 'image', 'manual');--> statement-breakpoint
CREATE TYPE "public"."meal_type" AS ENUM('breakfast', 'lunch', 'dinner', 'snack');--> statement-breakpoint
CREATE TYPE "public"."activity_session_state" AS ENUM('active', 'ended', 'interrupted');--> statement-breakpoint
CREATE TABLE "activity_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"state" "activity_session_state" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"starting_steps" integer NOT NULL,
	"current_steps" integer NOT NULL,
	"ending_steps" integer,
	"estimated_distance_meters" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_health_summaries" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"calories" integer DEFAULT 0 NOT NULL,
	"protein_grams" double precision DEFAULT 0 NOT NULL,
	"steps" integer,
	"has_meal_data" boolean DEFAULT false NOT NULL,
	"has_activity_data" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_health_summaries_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "health_goals" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"goal_type" "goal_type" NOT NULL,
	"current_weight_kg" double precision NOT NULL,
	"target_weight_kg" double precision NOT NULL,
	"height_cm" double precision NOT NULL,
	"age_years" integer NOT NULL,
	"activity_level" "activity_level" NOT NULL,
	"daily_calorie_target" integer NOT NULL,
	"daily_protein_target_grams" integer NOT NULL,
	"daily_step_target" integer NOT NULL,
	"time_zone" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_id" uuid NOT NULL,
	"name" text NOT NULL,
	"portion_amount" double precision NOT NULL,
	"portion_unit" text NOT NULL,
	"portion_display_text" text NOT NULL,
	"calories" double precision NOT NULL,
	"protein_grams" double precision NOT NULL,
	"carbs_grams" double precision NOT NULL,
	"fat_grams" double precision NOT NULL,
	"confidence" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"meal_type" "meal_type" NOT NULL,
	"source" "meal_source" NOT NULL,
	"total_calories" double precision NOT NULL,
	"total_protein_grams" double precision NOT NULL,
	"total_carbs_grams" double precision NOT NULL,
	"total_fat_grams" double precision NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"time_zone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_sessions" ADD CONSTRAINT "activity_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_health_summaries" ADD CONSTRAINT "daily_health_summaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_goals" ADD CONSTRAINT "health_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;