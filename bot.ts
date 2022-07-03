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

interface SearchResult {
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
		name: "game-community",
		description: "Get a link to a game's community",
		options: [
			{
				autocomplete: true,
				type: "STRING",
				name: "game",
				description: "A game's abbreviation",
			},
		],
	},
	{
		name: "series-community",
		description: "Get a link to a series' community",
		options: [
			{
				autocomplete: true,
				type: "STRING",
				name: "series",
				description: "A series' abbreviation",
			},
		],
	},
];

class SpeedrunCom extends ApplicationCommandsModule {
	@slash("game-community")
	async gameCommunity(t: ApplicationCommandInteraction) {
		await t.defer();
		const res = await fetch(
			`https://www.speedrun.com/api/v1/games/${t.option("game")}`,
		);
		const game = (await res.json()).data as SearchResult;

		if (game) {
			await t.reply({
				content: game.discord
					? `Here's the invite to \`${game.names.international}\`: ${game.discord}`
					: `Couldn't find any invite for \`${game.names.international}\`, here's a link to their forums: ${game.weblink}/forum`,
			});
		} else {
			await t.reply({
				content: `\`${t.option("game")}\` game not found`,
			});
		}
	}

	@slash("series-community")
	async seriesCommunity(t: ApplicationCommandInteraction) {
		await t.defer();
		const res = await fetch(
			`https://www.speedrun.com/api/v1/series/${t.option("series")}`,
		);
		const series = (await res.json()).data as SearchResult;

		if (series) {
			await t.reply({
				content: series.discord
					? `Here's the invite to the \`${series.names.international} series\`: ${series.discord}`
					: `Couldn't find any invite for the \`${series.names.international} series\`, here's a link to their forums: ${series.weblink}/forum`,
			});
		} else {
			await t.reply({
				content: `\`${t.option("series")} series\` not found`,
			});
		}
	}

	@autocomplete("*", "*")
	async Autocomplete(d: AutocompleteInteraction) {
		const completions: ApplicationCommandChoice[] = [];
		const isGame = Boolean(d.option("game"));
		const res = await fetch(
			`https://www.speedrun.com/api/v1/${isGame ? "games" : "series"}?name=${
				encodeURIComponent(d.focusedOption.value)
			}`,
		);
		const body = (await res.json()).data as SearchResult[];
		completions.push(...body.map((search) => ({
			name: isGame
				? search.names.international
				: `${search.names.international} series`,
			value: search.abbreviation,
		})));
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
