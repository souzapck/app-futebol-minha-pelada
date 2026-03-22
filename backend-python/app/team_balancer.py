POSITIONS_ORDER = ["GOL", "ZAG", "LAT", "MEI", "ATA"]

def balance_teams(players, players_per_team: int = 6):
    players = list(players)
    num_teams = len(players) // players_per_team
    if num_teams < 2:
        return []

    goleiros = [p for p in players if p.position == "GOL"]
    linha = [p for p in players if p.position != "GOL"]

    goleiros.sort(key=lambda p: p.rating, reverse=True)
    linha.sort(key=lambda p: p.rating, reverse=True)

    teams = [
        {"name": f"Time {i+1}", "players": [], "totalRating": 0}
        for i in range(num_teams)
    ]

    # goleiros
    for idx, gk in enumerate(goleiros):
        team_index = idx % num_teams
        teams[team_index]["players"].append(gk)
        teams[team_index]["totalRating"] += gk.rating

    def count_position(team, pos):
        return len([p for p in team["players"] if p.position == pos])

    # linha
    for player in linha:
        best_team = None
        best_score = None

        for team in teams:
            if len(team["players"]) >= players_per_team:
                continue
            pos_count = count_position(team, player.position)
            has_same_pos = pos_count > 0
            projected_rating = team["totalRating"] + player.rating
            if has_same_pos:
                projected_rating += 0.5

            if best_score is None or projected_rating < best_score:
                best_score = projected_rating
                best_team = team

        if best_team:
            best_team["players"].append(player)
            best_team["totalRating"] += player.rating

    # converter para formato serializável
    result = []
    for team in teams:
        result.append(
            {
                "name": team["name"],
                "totalRating": team["totalRating"],
                "players": [
                    {
                        "id": p.id,
                        "name": p.name,
                        "rating": p.rating,
                        "position": p.position,
                    }
                    for p in team["players"]
                ],
            }
        )
    return result
