import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  linkedSignal,
  viewChild,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatPaginatorModule } from "@angular/material/paginator";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatSortModule } from "@angular/material/sort";
import { MatTableModule } from "@angular/material/table";
import { MatTooltipModule } from "@angular/material/tooltip";
import { debounce, form, FormField } from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { Observable } from "rxjs";
import { AppBreadcrumbsComponent } from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { LeagueRequiredComponent } from "../../../shared/league-required/league-required.component";
import { listState } from "../../../shared/list-state/list-state";
import { FiltersPanelComponent } from "../../../shared/mobile-filters/filters-panel.component";
import { FiltersToggleComponent } from "../../../shared/mobile-filters/filters-toggle.component";
import { injectIsMobile } from "../../../shared/responsive/is-mobile";
import {
  mobileList,
  mobilePageSize,
} from "../../../shared/responsive/mobile-list";
import {
  RowAction,
  RowActionsComponent,
} from "../../../shared/row-actions/row-actions.component";
import { LogoImageComponent } from "../../../shared/logo-image/logo-image.component";
import { PlayerBanDialogComponent } from "../player-ban-dialog/player-ban-dialog.component";
import {
  PlayerDetailDialogComponent,
  PlayerDetailDialogData,
} from "../player-detail-dialog/player-detail-dialog.component";
import { PlayerGenderDialogComponent } from "../player-gender-dialog/player-gender-dialog.component";
import {
  BanResult,
  formatBirthDate,
  fullName,
  Player,
  PLAYER_GENDERS,
  PlayersFilters,
} from "../player.model";
import { PlayersApi } from "../players.api";

/** Teams listed under a player; the rest are summed up as "+N participaciones más" */
const MAX_TEAMS_SHOWN = 3;

@Component({
  selector: "app-players-list",
  templateUrl: "./players-list.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "app-page-fill" },
  imports: [
    AppBreadcrumbsComponent,
    AppPageLayoutComponent,
    AppPageLayoutContentDirective,
    AppSecondaryToolbarComponent,
    FiltersPanelComponent,
    FiltersToggleComponent,
    FormField,
    LeagueRequiredComponent,
    LogoImageComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    NgTemplateOutlet,
    RowActionsComponent,
    TranslocoPipe,
  ],
})
export class PlayersListComponent {
  private readonly api = inject(PlayersApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  protected readonly leagueContext = inject(LeagueContextService);

  readonly isMobile = injectIsMobile();

  private readonly dataColumns = [
    "photo",
    "name",
    "gender",
    "age",
    "phone",
    "status",
  ];

  /** Desktop: icon buttons in a sticky last column. Phones: a "⋮" menu as the first one. */
  readonly columns = computed(() =>
    this.isMobile()
      ? ["actionsMenu", ...this.dataColumns]
      : [...this.dataColumns, "actions"],
  );
  readonly genders = PLAYER_GENDERS;

  /** Another league starts again with empty filters, as when the screen is opened */
  readonly filters = linkedSignal<number | null, PlayersFilters>({
    source: this.leagueContext.activeLeagueId,
    computation: () => ({
      search: "",
      gender: "",
      status: "",
    }),
  });
  readonly filtersForm = form(this.filters, (filter) => {
    debounce(filter.search, 300);
  });

  private readonly list = listState({
    filters: this.filters,
    defaultSort: { active: "name", direction: "asc" },
    // Another league has other players: start again from the first page
    resetOn: this.leagueContext.activeLeagueId,
    pageSize: mobilePageSize(this.isMobile()),
    load: (query) => this.api.list(query),
  });

  readonly sortState = this.list.sortState;
  readonly paging = this.list.paging;
  readonly resource = this.list.resource;
  readonly rows = this.list.rows;
  readonly total = this.list.total;
  readonly hasFilters = this.list.hasFilters;
  readonly sort = this.list.sort;

  private readonly tableCard = viewChild<ElementRef<HTMLElement>>("tableCard");

  /** Phones: the folding filters panel, its badge and the page scroll */
  private readonly mobile = mobileList({
    filters: this.filters,
    activeKeys: ["gender", "status"],
    changePage: this.list.changePage,
    tableCard: this.tableCard,
  });
  readonly filtersOpen = this.mobile.filtersOpen;
  readonly activeFilters = this.mobile.activeFilters;
  readonly clearFilters = this.mobile.clearFilters;
  readonly changePage = this.mobile.changePage;

  readonly crumbs = computed(() => [this.transloco.translate("nav.players")]);

  protected readonly fullName = fullName;
  protected readonly formatBirthDate = formatBirthDate;

  /** "Halcones · Torneo Apertura" for each team the player is active in, up to the first few */
  teams(player: Player): string[] {
    return player.active_teams
      .slice(0, MAX_TEAMS_SHOWN)
      .map(({ team, tournament }) =>
        [team, tournament].filter(Boolean).join(" · "),
      );
  }

  /** How many teams do not fit in the list */
  moreTeams(player: Player): number {
    return Math.max(0, player.active_teams.length - MAX_TEAMS_SHOWN);
  }

  /** The row's actions for the phone menu: the same as the desktop buttons */
  rowActions(player: Player): RowAction[] {
    return [
      {
        icon: "mat:visibility",
        labelKey: "players.actions.detail",
        run: () => this.openDetail(player),
      },
      {
        icon: "mat:edit",
        labelKey: "players.actions.gender",
        run: () => this.changeGender(player),
      },
      {
        icon: player.is_banned ? "mat:check_circle" : "mat:block",
        labelKey: player.is_banned
          ? "players.actions.reactivate"
          : "players.actions.ban",
        run: () => this.toggleBan(player),
        danger: !player.is_banned,
      },
    ];
  }

  openDetail(player: Player): void {
    this.dialog.open<PlayerDetailDialogComponent, PlayerDetailDialogData>(
      PlayerDetailDialogComponent,
      {
        data: { playerId: player.id },
        autoFocus: "dialog",
        width: "640px",
        maxWidth: "95vw",
      },
    );
  }

  changeGender(player: Player): void {
    this.dialog
      .open<PlayerGenderDialogComponent, Player, boolean>(
        PlayerGenderDialogComponent,
        {
          data: player,
          width: "480px",
          maxWidth: "95vw",
          autoFocus: "dialog",
        },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.resource.reload();
          this.snackbar.notifySuccess("players.genderUpdated");
        }
      });
  }

  /** Banning asks why; reactivating asks to confirm */
  toggleBan(player: Player): void {
    if (player.is_banned) {
      this.confirmDialog
        .confirm({
          key: "players.unban",
          params: { name: fullName(player) },
          tone: "primary",
        })
        .subscribe((confirmed) => {
          if (confirmed) {
            this.run(this.api.unban(player.id), "players.unbanned");
          }
        });

      return;
    }

    this.dialog
      .open<PlayerBanDialogComponent, Player, BanResult>(
        PlayerBanDialogComponent,
        { data: player, width: "480px", maxWidth: "95vw" },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.resource.reload();
          this.snackbar.success(this.banMessage(result));
        }
      });
  }

  /** "Jugador vetado. Se quitó de 2 plantillas y se canceló 1 solicitud." */
  private banMessage({ removed_rosters, cancelled_requests }: BanResult) {
    const parts = [
      removed_rosters > 0
        ? this.transloco.translate(
            removed_rosters === 1
              ? "players.banResult.removed.one"
              : "players.banResult.removed.other",
            { count: removed_rosters },
          )
        : "",
      cancelled_requests > 0
        ? this.transloco.translate(
            cancelled_requests === 1
              ? "players.banResult.cancelled.one"
              : "players.banResult.cancelled.other",
            { count: cancelled_requests },
          )
        : "",
    ].filter(Boolean);
    const banned = this.transloco.translate("players.banned");

    return parts.length
      ? `${banned} ${parts.join(this.transloco.translate("players.banResult.join"))}.`
      : banned;
  }

  private run(request: Observable<unknown>, successKey: string): void {
    request.subscribe({
      next: () => {
        this.resource.reload();
        this.snackbar.notifySuccess(successKey);
      },
      error: (error: unknown) => this.snackbar.notifyFailure(error),
    });
  }
}
