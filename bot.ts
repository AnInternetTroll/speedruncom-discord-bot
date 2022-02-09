#!/usr/bin/env -S deno run --allow-net=gateway.discord.gg,discord.com,www.www.speedrun.com --no-check --allow-env=DENO_DEPLOYMENT_ID,TOKEN,TEST_SERVER
import {
	ApplicationCommandChoice,
	ApplicationCommandInteraction,
	ApplicationCommandsModule,
	autocomplete,
	AutocompleteInteraction,
	Client,
	InteractionsClient,
	slash,
	SlashCommandPartial,
} from "https://deno.land/x/harmony@v2.5.1/mod.ts";
import { serve, Status } from "https://deno.land/std@0.125.0/http/mod.ts";

interface Game {
	id: string;
	names: {
		international: string;
		japanese?: string;
		twitch: string;
	};
	abbreviation: string;
	weblink: string;
	discord: string;
	links: {
		rel: string;
		uri: string;
	}[];
}

const commands: SlashCommandPartial[] = [
	{
		name: "community",
		description: "Get a link to the game's community",
		options: [
			{
				autocomplete: true,
				type: "STRING",
				name: "game",
				description: "A game's abbreviation",
				required: true,
			},
		],
	},
];

class SpeedrunCom extends ApplicationCommandsModule {
	@slash("community")
	async community(t: ApplicationCommandInteraction) {
		await t.defer();
		const gameResponse = await fetch(
			`https://www.speedrun.com/api/v1/games?abbreviation=${
				encodeURIComponent(t.option<string>("game"))
			}`,
		);
		const gameResponseData = await gameResponse.json();
		const game = gameResponseData.data[0] as Game;

		if (game) {
			await t.reply({
				content: game.discord
					? `Here's the invite to ${game.names.international}: ${game.discord}`
					: `Couldn't find any invite for ${game.names.international}, here's a link to their forums: ${game.weblink}/forum`,
			});
		} else {
			await t.reply({
				content: `${t.option("game")} game not found`,
			});
		}
	}

	@autocomplete("*", "game")
	async gameAutocomplete(d: AutocompleteInteraction) {
		const completions: ApplicationCommandChoice[] = [];
		if (d.focusedOption.name === "game") {
			const res = await fetch(
				`https://www.speedrun.com/api/v1/games?name=${encodeURIComponent(d.focusedOption.value)}`,
			);
			const body = await res.json();
			completions.push(...(body.data as Game[]).map((game) => ({
				name: game.names.international,
				value: game.abbreviation,
			})));
		} 
		return await d.autocomplete(
			completions,
		);
	}
}

if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
	const client = new InteractionsClient({
		publicKey: Deno.env.get("PUBLIC_KEY"),
		token: Deno.env.get("TOKEN"),
	});
	client.loadModule(new SpeedrunCom());

	serve((request) => {
		const url = new URL(request.url);
		const { pathname } = url;
		switch (pathname) {
			case "/discord-interaction": {
				return new Promise((respondWith) => {
					client.verifyFetchEvent({ request, respondWith });
				});
			}
			default: {
				return new Response("Not found", {
					status: Status.NotFound,
				});
			}
		}
	});
} else {
	const client = new Client({
		token: Deno.env.get("TOKEN"),
		intents: [],
	});
	console.log("Connecting to discord...");
	client.interactions.loadModule(new SpeedrunCom());
	await client.connect();
	console.log("Connected");
	if (Deno.args.includes("--update")) {
		console.log("Updating slash commands...");
		await client.interactions.commands.bulkEdit(
			commands,
			Deno.env.get("TEST_SERVER"),
		);
		console.log("Updated slash commands");

		console.log("Closing");
		await client.close();
		console.log("Closed");

		Deno.exit(0);
	}
}
