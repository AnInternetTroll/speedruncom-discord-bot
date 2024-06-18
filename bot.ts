#!/usr/bin/env -S deno run --allow-net=gateway.discord.gg,discord.com,www.speedrun.com --no-check --allow-env=DENO_DEPLOYMENT_ID,TOKEN,TEST_SERVER --allow-read --no-prompt
import {
	ApplicationCommandInteraction,
	ApplicationCommandOption,
	ApplicationCommandOptionType,
	ApplicationCommandsModule,
	// autocomplete,
	AutocompleteInteraction,
	Client,
	InteractionsClient,
	// slash,
	SlashCommandPartial,
	User,
} from "https://deno.land/x/harmony@v2.9.1/mod.ts";
import { STATUS_CODE } from "https://deno.land/std@0.224.0/http/mod.ts";
import { GatewayIntents } from "https://deno.land/x/harmony@v2.9.1/src/types/gateway.ts";

interface BaseGameAndSeries {
	id: string;
	name: string;
	url: string;
}

interface v2SearchResult {
	challengeList: unknown[];
	gameList: BaseGameAndSeries[];
	newsList: unknown[];
	pageList: unknown[];
	seriesList: BaseGameAndSeries[];
	userList: unknown[];
}

interface v1SearchResult {
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

const enum CommandNames {
	gameCommunity = "game-community",
	seriesCommunity = "series-community",
	sourceCode = "sourceCode",
}

const mentionUserOption: ApplicationCommandOption = {
	name: "mention",
	description: "Notify a user with the community's link",
	type: ApplicationCommandOptionType.USER,
};

const commands: SlashCommandPartial[] = [
	{
		name: CommandNames.gameCommunity,
		description: "Get a link to a game's community",
		options: [
			{
				name: "game",
				description: "A game's URL",
				type: ApplicationCommandOptionType.STRING,
				autocomplete: true,
				required: true,
			},
			mentionUserOption,
		],
	},
	{
		name: CommandNames.seriesCommunity,
		description: "Get a link to a series' community",
		options: [
			{
				name: "series",
				description: "A series' URL",
				type: ApplicationCommandOptionType.STRING,
				autocomplete: true,
				required: true,
			},
			mentionUserOption,
		],
	},
	{
		name: CommandNames.sourceCode,
		description: "Get a link to the bot's source code",
	},
];

// Disabling decorators because they require a config file on deno deploy
// https://deno.com/deploy/changelog#es-decorators-are-enabled-on-deno-deploy-replacing-experimental-ts-decorators
class SpeedrunCom extends ApplicationCommandsModule {
	// @slash(CommandNames.gameCommunity)
	static async gameCommunity(i: ApplicationCommandInteraction) {
		await i.defer();
		const res = await fetch(
			`https://www.speedrun.com/api/v1/games/${i.option("game")}`,
		);
		const game: v1SearchResult | undefined = (await res.json()).data;
		const userMention = i.option("mention");
		const userId = userMention && userMention instanceof User
			? userMention.id
			: undefined;
		console.log(userId);

		if (!game) {
			await i.reply(
				userMention
					? `${userMention}, the \`${i.option("game")}\` game wasn't found`
					: `The \`${i.option("game")}\` game wasn't found`,
				{ allowedMentions: userId ? { users: [userId] } : undefined },
			);
			return;
		}

		if (userMention) {
			await i.reply(
				game.discord
					? `${userMention}, here's the invite to \`${game.names.international}\`: ${game.discord}`
					: `${userMention}, couldn't find any Discord invite for \`${game.names.international}\`. Here's a link to their forums: ${game.weblink}/forums`,
				{ allowedMentions: userId ? { users: [userId] } : undefined },
			);
			return;
		}

		await i.reply(
			game.discord
				? `Here's the invite to \`${game.names.international}\`: ${game.discord}`
				: `Couldn't find any Discord invite for \`${game.names.international}\`. Here's a link to their forums: ${game.weblink}/forums`,
			{ allowedMentions: userId ? { users: [userId] } : undefined },
		);
	}

	// @slash(CommandNames.seriesCommunity)
	static async seriesCommunity(i: ApplicationCommandInteraction) {
		await i.defer();
		const res = await fetch(
			`https://www.speedrun.com/api/v1/series/${i.option("series")}`,
		);
		const series: v1SearchResult | undefined = (await res.json()).data;
		const userMention = i.option("mention");
		const userId = userMention && userMention instanceof User
			? userMention.id
			: undefined;

		if (!series) {
			await i.reply(
				userMention
					? `${userMention}, the \`${i.option("series")} Series\` wasn't found`
					: `The \`${i.option("series")} Series\` wasn't found`,
				{ allowedMentions: userId ? { users: [userId] } : undefined },
			);
			return;
		}

		// series.weblink doesn't have the "/series/" prefix
		const formLink =
			`https://www.speedrun.com/series/${series.abbreviation}/forums`;

		if (userMention) {
			await i.reply(
				series.discord
					? `${userMention}, here's the invite to the \`${series.names.international} Series\`: ${series.discord}`
					: `${userMention}, couldn't find any Discord invite for the \`${series.names.international} Series\`. Here's a link to their forums: ${formLink}`,
				{ allowedMentions: userId ? { users: [userId] } : undefined },
			);
			return;
		}

		await i.reply(
			series.discord
				? `Here's the invite to the \`${series.names.international} Series\`: ${series.discord}`
				: `Couldn't find any Discord invite for the \`${series.names.international} Series\`. Here's a link to their forums: ${formLink}`,
		);
	}

	// @slash(CommandNames.sourceCode)
	static async sourceCode(i: ApplicationCommandInteraction) {
		await i.reply(
			"Here's the link to the repository: https://github.com/AnInternetTroll/speedruncom-discord-bot",
		);
	}

	// @autocomplete("*", "*")
	static async myAutocomplete(d: AutocompleteInteraction) {
		if (!d.focusedOption.value) {
			await d.autocomplete([]);
			return;
		}

		const isGame = Boolean(d.focusedOption.name == "game");

		const v2Res = await fetch("https://www.speedrun.com/api/v2/GetSearch", {
			body: JSON.stringify({
				query: d.focusedOption.value,
				limit: 20,
				favorExactMatches: false,
				includeGames: isGame,
				includeSeries: !isGame,
			}),
			method: "POST",
		});

		if (v2Res.ok) {
			const body: v2SearchResult = await v2Res.json();

			const list = isGame ? body.gameList : body.seriesList;
			await d.autocomplete(
				list.map((x) => ({
					name: isGame ? x.name : `${x.name} Series`,
					value: x.url,
				})),
			);
			return;
		}

		// API v1 runs if API v2 fails
		const v1Res = await fetch(
			`https://www.speedrun.com/api/v1/${isGame ? "games" : "series"}?name=${
				encodeURIComponent(d.focusedOption.value)
			}`,
		);
		const v1Body: v1SearchResult[] = (await v1Res.json()).data;

		await d.autocomplete(
			v1Body.map((x) => ({
				name: isGame
					? x.names.international
					: `${x.names.international} Series`,
				value: x.abbreviation,
			})),
		);
		return;
	}
}

async function updateCommands() {
	const client = new Client({
		token: Deno.env.get("TOKEN"),
		intents: [],
	});
	await client.connect();
	await client.interactions.commands.bulkEdit(
		commands,
		Deno.env.get("TEST_SERVER"),
	);
	await client.off();
}

function addEventsToInteractionClient(client: InteractionsClient) {
	// const speedrunCom = new SpeedrunCom();
	// client.loadModule(speedrunCom);

	client.on("interactionError", (e) => {
		console.error(e);
	});

	client.on("interaction", (i) => {
		if (i.isAutocomplete()) {
			return SpeedrunCom.myAutocomplete(i);
		}
		if (i.isApplicationCommand()) {
			switch (i.name as CommandNames) {
				case CommandNames.gameCommunity:
					return SpeedrunCom.gameCommunity(i);
				case CommandNames.seriesCommunity:
					return SpeedrunCom.seriesCommunity(i);
				case CommandNames.sourceCode:
					return SpeedrunCom.sourceCode(i);
			}
			console.log("Command not found", i.name);
		}
		console.log("Interaction not found", i.type);
	});
}

if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
	const client = new InteractionsClient({
		publicKey: Deno.env.get("PUBLIC_KEY"),
		token: Deno.env.get("TOKEN"),
	});
	addEventsToInteractionClient(client);
	await updateCommands();

	Deno.serve((request) => {
		const url = new URL(request.url);
		const { pathname } = url;
		switch (pathname) {
			case "/discord-interaction": {
				// deno-lint-ignore no-async-promise-executor
				return new Promise(async (res) => {
					const interaction = await client.verifyFetchEvent({
						respondWith: res,
						request,
					});
					if (interaction === false) {
						return res(
							new Response(null, {
								status: STATUS_CODE.Unauthorized,
							}),
						);
					}
					if (interaction.type === 1) return interaction.respond({ type: 1 });
					await client._process(interaction);
				});
			}
			default: {
				return new Response("Not found", {
					status: STATUS_CODE.NotFound,
				});
			}
		}
	});
} else {
	const client = new Client({
		token: Deno.env.get("TOKEN"),
		intents: [],
	});
	addEventsToInteractionClient(client.interactions);
	console.log("Connecting to discord...");
	await client.connect();
	console.log("Connected");
	if (Deno.args.includes("--update")) {
		console.log("Updating slash commands...");
		await updateCommands();
		console.log("Updated slash commands");

		console.log("Closing");
		await client.off();
		console.log("Closed");

		Deno.exit(0);
	}
}
