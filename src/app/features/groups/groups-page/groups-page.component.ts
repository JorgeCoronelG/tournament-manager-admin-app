import { DatePipe, NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatTooltipModule } from "@angular/material/tooltip";
import { form, FormField } from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { AppBreadcrumbsComponent } from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { LeagueRequiredComponent } from "../../../shared/league-required/league-required.component";
import { LogoImageComponent } from "../../../shared/logo-image/logo-image.component";
import { TournamentStatusChipComponent } from "../../tournaments/tournament-status-chip/tournament-status-chip.component";
import { parseDate } from "../../tournaments/tournament.model";
import { TournamentsApi } from "../../tournaments/tournaments.api";
import { Group, GroupTeam, RegularGroup } from "../group.model";
import {
  GroupFormDialogComponent,
  GroupFormDialogData,
} from "../group-form-dialog/group-form-dialog.component";
import {
  PlayoffFormDialogComponent,
  PlayoffFormDialogData,
} from "../playoff-form-dialog/playoff-form-dialog.component";
import { GroupsApi } from "../groups.api";

/** Groups of a tournament: who plays where in the regular phase, and the playoffs fed by them */
@Component({
  selector: "app-groups-page",
  templateUrl: "./groups-page.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppBreadcrumbsComponent,
    AppPageLayoutComponent,
    AppPageLayoutContentDirective,
    AppSecondaryToolbarComponent,
    DatePipe,
    FormField,
    LeagueRequiredComponent,
    LogoImageComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
    NgTemplateOutlet,
    TournamentStatusChipComponent,
    TranslocoPipe,
  ],
})
export class GroupsPageComponent {
  private readonly api = inject(GroupsApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  protected readonly leagueContext = inject(LeagueContextService);
  protected readonly parseDate = parseDate;

  protected readonly tournamentsResource = inject(TournamentsApi).options();
  readonly tournaments = computed(() =>
    this.tournamentsResource.hasValue()
      ? this.tournamentsResource.value().data
      : [],
  );

  /** The tournament picker ("" until one is chosen) */
  readonly picker = signal<{ tournament: number | "" }>({ tournament: "" });
  readonly pickerForm = form(this.picker);

  readonly tournament = computed(() => {
    const id = this.picker().tournament;

    return this.tournaments().find((item) => item.id === id);
  });
  private readonly tournamentId = computed(() => this.tournament()?.id);

  /** Only a tournament in planning can change its groups */
  readonly editable = computed(() => this.tournament()?.status === "planning");

  /** Playoffs can still be created and edited until the tournament reaches its playoff stage */
  readonly playoffsOpen = computed(() => {
    const status = this.tournament()?.status;

    return status === "planning" || status === "in_progress";
  });

  /** Why the groups are locked (translation key), or null while they can change */
  readonly lockedNotice = computed(() => {
    const status = this.tournament()?.status;

    return status && status !== "planning" ? `groups.readOnly.${status}` : null;
  });

  /** A playoff's buttons: the tournament allows it and so does the backend's `editable` */
  playoffEditable(playoff: Group): boolean {
    return this.playoffsOpen() && playoff.editable !== false;
  }

  /** Matches have a date only when the playoff was given them */
  hasDates(playoff: Group): boolean {
    return !!playoff.rounds_detail?.some((round) =>
      round.dates.some((date) => date),
    );
  }

  /** The rounds as text; a round of two matches says so: "Semifinal (ida y vuelta)" */
  roundNames(playoff: Group): string {
    return (playoff.rounds_detail ?? [])
      .map((round) =>
        round.legs === 2
          ? this.transloco.translate("groups.playoff.twoLegs", {
              name: round.name,
            })
          : round.name,
      )
      .join(", ");
  }

  /** One line per match with its date: "Semifinal (ida)", "Semifinal (vuelta)", "Final" */
  matchLines(playoff: Group): Array<{ label: string; date: string | null }> {
    return (playoff.rounds_detail ?? []).flatMap((round) =>
      round.legs === 2
        ? [
            {
              label: this.transloco.translate("groups.playoff.legFirst", {
                name: round.name,
              }),
              date: round.dates[0] ?? null,
            },
            {
              label: this.transloco.translate("groups.playoff.legSecond", {
                name: round.name,
              }),
              date: round.dates[1] ?? null,
            },
          ]
        : [{ label: round.name, date: round.dates[0] ?? null }],
    );
  }

  // A tournament that is no longer in the league (another league was picked) is dropped
  private readonly dropGoneTournament = effect(() => {
    if (
      this.picker().tournament !== "" &&
      this.tournamentsResource.hasValue() &&
      !this.tournament()
    ) {
      this.picker.set({ tournament: "" });
    }
  });

  readonly resource = this.api.view(this.tournamentId);
  readonly view = computed(() => this.resource.value());

  readonly regular = computed(() => this.view()?.regular ?? []);
  readonly playoffs = computed(() => this.view()?.playoffs ?? []);
  readonly unassigned = computed(() => this.view()?.unassigned ?? []);
  readonly finalsAligned = computed(() => this.view()?.finalsAligned ?? true);

  /** With one group there is nowhere to move a team to */
  readonly single = computed(() => this.regular().length === 1);
  readonly canRandomize = computed(() => this.regular().length >= 2);

  readonly crumbs = computed(() => [
    this.transloco.translate("nav.tournaments"),
    this.transloco.translate("nav.groups"),
  ]);

  /** A group can go only if it is empty, not the last and no playoff takes teams from it */
  canDelete(group: RegularGroup): boolean {
    return (
      this.regular().length > 1 &&
      group.teams_count === 0 &&
      !this.playoffs().some((playoff) =>
        playoff.sources?.some((source) => source.source_group_id === group.id),
      )
    );
  }

  /** Teams assigned to a group, for the moves menu: every other regular group */
  otherGroups(current: Group | null): RegularGroup[] {
    return this.regular().filter((group) => group.id !== current?.id);
  }

  newGroup(): void {
    this.openGroupDialog();
  }

  rename(group: Group): void {
    this.openGroupDialog(group);
  }

  private openGroupDialog(group?: Group): void {
    const tournament = this.tournament();

    if (!tournament || !this.editable()) {
      return;
    }

    this.dialog
      .open<GroupFormDialogComponent, GroupFormDialogData, Group>(
        GroupFormDialogComponent,
        {
          data: { tournamentId: tournament.id, group },
          width: "420px",
          maxWidth: "95vw",
        },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.resource.reload();
          this.snackbar.notifySuccess(
            group ? "groups.renamed" : "groups.created",
          );
        }
      });
  }

  /** The confirmation is the same for a group and a playoff; each one has its own texts */
  remove(group: Group): void {
    const tournament = this.tournament();
    const allowed =
      group.type === "playoff" ? this.playoffsOpen() : this.editable();

    if (!tournament || !allowed) {
      return;
    }

    this.confirmDialog
      .confirm({
        key:
          group.type === "playoff" ? "groups.deletePlayoff" : "groups.delete",
        params: { name: group.name },
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.api.remove(tournament.id, group.id).subscribe({
          next: () => {
            this.resource.reload();
            this.snackbar.notifySuccess(
              group.type === "playoff"
                ? "groups.playoffDeleted"
                : "groups.deleted",
            );
          },
          error: (error: unknown) => this.snackbar.notifyFailure(error),
        });
      });
  }

  /** Moves a team to a group (any regular one); the list reloads either way */
  move(team: GroupTeam, group: Group): void {
    const tournament = this.tournament();

    if (!tournament || !this.editable()) {
      return;
    }

    this.api
      .assign(tournament.id, [{ registration_id: team.id, group_id: group.id }])
      .subscribe({
        next: () => {
          this.resource.reload();
          this.snackbar.notifySuccess("groups.moved");
        },
        error: (error: unknown) => {
          this.resource.reload();
          this.snackbar.notifyFailure(error);
        },
      });
  }

  randomize(): void {
    const tournament = this.tournament();

    if (!tournament || !this.editable() || !this.canRandomize()) {
      return;
    }

    this.confirmDialog
      .confirm({ key: "groups.random", tone: "primary" })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.api.randomAssignment(tournament.id).subscribe({
          next: () => {
            this.resource.reload();
            this.snackbar.notifySuccess("groups.randomized");
          },
          error: (error: unknown) => this.snackbar.notifyFailure(error),
        });
      });
  }

  newPlayoff(): void {
    this.openPlayoffDialog();
  }

  editPlayoff(playoff: Group): void {
    this.openPlayoffDialog(playoff);
  }

  private openPlayoffDialog(playoff?: Group): void {
    const tournament = this.tournament();

    if (!tournament || !this.playoffsOpen()) {
      return;
    }

    this.dialog
      .open<PlayoffFormDialogComponent, PlayoffFormDialogData, Group>(
        PlayoffFormDialogComponent,
        {
          data: {
            tournamentId: tournament.id,
            groups: this.regular(),
            playoff,
          },
          width: "860px",
          maxWidth: "95vw",
        },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.resource.reload();
          this.snackbar.notifySuccess(
            playoff ? "groups.playoffUpdated" : "groups.playoffCreated",
          );
        }
      });
  }
}
